const prisma = require("../utils/prisma");
const { categoryFromScore, SOURCE_SCORE } = require("../utils/leadScorer");

// ─────────────────────────────────────────────────────────────────────────────
// Engagement-based lead scoring.
//
// A lead's temperature is recomputed from its full interaction history whenever
// something happens (a call, an email open/click, a WhatsApp reply, a status
// change). Score = intake base (source + contact info, never decays) + the sum of
// decayed engagement points. Recent activity counts for more; a hot-then-silent
// lead cools off as its engagement points decay. recomputeLeadScore is idempotent
// — it always derives the same score from the same history, so it can be called as
// often as we like with no drift or double-counting.
// ─────────────────────────────────────────────────────────────────────────────

const HALF_LIFE_DAYS = 30; // an engagement point is worth half as much 30 days later

// Per-interaction point values.
const PTS = {
    CALL_ATTEMPT:    2,   // outbound call that wasn't answered
    CALL_ANSWERED:   5,   // answered, neutral/unknown sentiment
    CALL_POSITIVE:  10,   // answered + positive sentiment
    CALL_NEGATIVE:  -5,   // answered + negative sentiment (cools the lead)
    EMAIL_OPENED:    3,
    EMAIL_CLICKED:   5,   // in addition to the open
    WHATSAPP_REPLY:  8,   // inbound reply — the strongest buy-signal
};

// Current-status bonus (state, not an event — does not decay).
const STATUS_BONUS = { NEW: 0, CONTACTED: 5, FOLLOW_UP: 10, CONVERTED: 25, LOST: -15 };

const ANSWERED_STATUSES = new Set(["COMPLETED", "CONNECTED", "ANSWERED"]);

const dayMs = 86_400_000;
const ageDays = (d) => Math.max(0, (Date.now() - new Date(d).getTime()) / dayMs);
const decay   = (days) => Math.pow(0.5, days / HALF_LIFE_DAYS);

function sentimentClass(s) {
    const x = (s || "").toString().toLowerCase();
    if (/good|positive|happy|interested/.test(x)) return "pos";
    if (/bad|negative|frustrat|angry|poor|upset/.test(x)) return "neg";
    return "neu";
}

const titleCase = (s) => (s || "").toLowerCase().replace(/(^|_)([a-z])/g, (_, p, c) => (p ? " " : "") + c.toUpperCase());
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

/**
 * Recompute a lead's score from its full interaction history and persist it.
 * @returns {Promise<{score:number, category:string}|null>}
 */
async function recomputeLeadScore(leadId) {
    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, source: true, phone: true, email: true, status: true },
    });
    if (!lead) return null;

    const [calls, emails, inboundWa] = await Promise.all([
        prisma.callLog.findMany({ where: { leadId }, select: { callStatus: true, duration: true, sentiment: true, callDate: true, createdAt: true } }),
        prisma.emailLog.findMany({ where: { leadId }, select: { openedAt: true, clickCount: true, lastClickedAt: true, createdAt: true } }),
        prisma.whatsAppMessage.findMany({ where: { leadId, direction: "INBOUND" }, select: { createdAt: true } }),
    ]);

    const factors = [];

    // 1. Intake base (no decay) ───────────────────────────────────────────────
    let base = SOURCE_SCORE[lead.source] ?? 10;
    factors.push({ label: `${titleCase(lead.source)} lead`, delta: SOURCE_SCORE[lead.source] ?? 10, direction: "up" });
    if (lead.phone) { base += 20; factors.push({ label: "Phone number on file", delta: 20, direction: "up" }); }
    if (lead.email) { base += 15; factors.push({ label: "Email on file", delta: 15, direction: "up" }); }

    // 2. Engagement (decayed) ──────────────────────────────────────────────────
    let engagement = 0, undecayed = 0, lastActivity = 0;
    const add = (when, raw) => {
        const d = raw * decay(ageDays(when));
        engagement += d; undecayed += raw;
        lastActivity = Math.max(lastActivity, new Date(when).getTime());
        return d;
    };

    // Calls — grouped by disposition so the explanation reads clearly.
    const callPts = { pos: 0, neu: 0, neg: 0, attempt: 0 };
    const callCnt = { pos: 0, neu: 0, neg: 0, attempt: 0 };
    for (const c of calls) {
        const when = c.callDate || c.createdAt;
        const answered = ANSWERED_STATUSES.has((c.callStatus || "").toUpperCase()) || (c.duration || 0) > 0;
        if (!answered) { callPts.attempt += add(when, PTS.CALL_ATTEMPT); callCnt.attempt++; continue; }
        const sent = sentimentClass(c.sentiment);
        if (sent === "pos") { callPts.pos += add(when, PTS.CALL_POSITIVE); callCnt.pos++; }
        else if (sent === "neg") { callPts.neg += add(when, PTS.CALL_NEGATIVE); callCnt.neg++; }
        else { callPts.neu += add(when, PTS.CALL_ANSWERED); callCnt.neu++; }
    }
    if (callCnt.pos)     factors.push({ label: plural(callCnt.pos, "positive call"), delta: Math.round(callPts.pos), direction: "up" });
    if (callCnt.neu)     factors.push({ label: `${plural(callCnt.neu, "call")} connected`, delta: Math.round(callPts.neu), direction: "up" });
    if (callCnt.attempt) factors.push({ label: `${plural(callCnt.attempt, "call")} attempted`, delta: Math.round(callPts.attempt), direction: "up" });
    if (callCnt.neg)     factors.push({ label: plural(callCnt.neg, "negative call"), delta: Math.round(callPts.neg), direction: "down" });

    // Emails — opens and clicks.
    let openPts = 0, clickPts = 0, opens = 0, clicks = 0;
    for (const e of emails) {
        if (e.openedAt) { openPts += add(e.openedAt, PTS.EMAIL_OPENED); opens++; }
        if ((e.clickCount || 0) > 0) { clickPts += add(e.lastClickedAt || e.createdAt, PTS.EMAIL_CLICKED); clicks++; }
    }
    if (opens)  factors.push({ label: `${plural(opens, "email")} opened`, delta: Math.round(openPts), direction: "up" });
    if (clicks) factors.push({ label: `${plural(clicks, "email link")} clicked`, delta: Math.round(clickPts), direction: "up" });

    // WhatsApp inbound replies.
    let waPts = 0;
    for (const m of inboundWa) waPts += add(m.createdAt, PTS.WHATSAPP_REPLY);
    if (inboundWa.length) factors.push({ label: `${plural(inboundWa.length, "WhatsApp reply")} received`, delta: Math.round(waPts), direction: "up" });

    // 3. Status bonus (current state, no decay) ────────────────────────────────
    const statusBonus = STATUS_BONUS[lead.status] ?? 0;
    if (statusBonus !== 0) factors.push({ label: `Stage: ${titleCase(lead.status)}`, delta: statusBonus, direction: statusBonus >= 0 ? "up" : "down" });

    // 4. Cooling — surface decay once past engagement has faded.
    const cooled = undecayed - engagement;
    if (cooled >= 4 && lastActivity) {
        const idle = Math.round(ageDays(lastActivity));
        if (idle >= 14) factors.push({ label: `No activity for ${idle} days`, delta: -Math.round(cooled), direction: "down" });
    }

    const score = Math.max(0, Math.min(100, Math.round(base + engagement + statusBonus)));
    const category = categoryFromScore(score);

    await prisma.lead.update({
        where: { id: leadId },
        data: { score, category, scoreExplanation: { factors, scoredAt: new Date().toISOString() } },
    });

    return { score, category };
}

// ── Per-call transcription sentiment scoring (used by the AI call analysis) ────
const SENTIMENT_DELTA = { Good: 20, Neutral: 0, Bad: -20 };
const URGENCY_DELTA   = { High: 15, Medium: 5, Low: -10 };
const TONE_DELTA      = { Professional: 10, Polite: 10, Casual: 0, Neutral: 0, Frustrated: -15, Aggressive: -20 };
const EMOTION_DELTA   = { Happy: 5, Calm: 5, Neutral: 0, Anxious: -5, Sad: -10, Angry: -15 };

const SENTIMENT_LABEL = { Good: "Positive sentiment", Neutral: "Neutral sentiment", Bad: "Negative sentiment" };
const URGENCY_LABEL   = { High: "High urgency", Medium: "Medium urgency", Low: "Low urgency" };
const TONE_LABEL      = { Professional: "Professional tone", Polite: "Polite tone", Casual: "Casual tone", Neutral: "Neutral tone", Frustrated: "Frustrated tone", Aggressive: "Aggressive tone" };
const EMOTION_LABEL   = { Happy: "Happy emotion", Calm: "Calm emotion", Neutral: "Neutral emotion", Anxious: "Anxious emotion", Sad: "Sad emotion", Angry: "Angry emotion" };

function buildFactor(label, delta) {
    if (delta === 0) return null;
    return { label, delta, direction: delta > 0 ? "up" : "down" };
}

function scoreFromTranscription({ sentiment, urgency, tone, emotion }) {
    const deltas = [
        { delta: SENTIMENT_DELTA[sentiment] ?? 0, label: SENTIMENT_LABEL[sentiment] ?? sentiment },
        { delta: URGENCY_DELTA[urgency]     ?? 0, label: URGENCY_LABEL[urgency]     ?? urgency  },
        { delta: TONE_DELTA[tone]           ?? 0, label: TONE_LABEL[tone]           ?? tone     },
        { delta: EMOTION_DELTA[emotion]     ?? 0, label: EMOTION_LABEL[emotion]     ?? emotion  },
    ];

    const score = Math.max(0, Math.min(100, 50 + deltas.reduce((sum, f) => sum + f.delta, 0)));
    const factors = deltas.map(f => buildFactor(f.label, f.delta)).filter(Boolean);
    return { score, factors };
}

/**
 * Called after a call is transcribed (its sentiment is now persisted on the call
 * row). Recomputing from history folds that new signal into the engagement score.
 * @returns {Promise<number|null>} the new score
 */
async function updateLeadScoreFromCall(leadId) {
    const result = await recomputeLeadScore(leadId);
    return result ? result.score : null;
}

module.exports = { recomputeLeadScore, scoreFromTranscription, updateLeadScoreFromCall };
