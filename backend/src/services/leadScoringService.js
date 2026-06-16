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

// Per-interaction point values — engagement drives score, not profile completeness.
const PTS = {
    CALL_ATTEMPT:    4,   // outbound call that wasn't answered
    CALL_ANSWERED:  10,   // answered, neutral/unknown sentiment
    CALL_POSITIVE:  18,   // answered + positive sentiment
    CALL_NEGATIVE:  -8,   // answered + negative sentiment (cools the lead)
    EMAIL_OPENED:    6,
    EMAIL_CLICKED:  10,   // in addition to the open
    WHATSAPP_REPLY: 14,   // inbound reply — the strongest buy-signal
};

// Current-status bonus (state, not an event — does not decay).
const STATUS_BONUS = { NEW: 0, CONTACTED: 8, FOLLOW_UP: 15, CONVERTED: 35, LOST: -20 };

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
 * DISABLED. Engagement-based lead scoring is turned off in the multi-department
 * model (it keyed off the now-removed global Lead.status). The intake score set at
 * creation by utils/leadScorer (source + contact info, no status) is left as-is.
 *
 * Kept as a no-op so the many fire-and-forget callers
 * (recomputeLeadScore(id).catch(...)) and the `if (rescored)` guards stay valid
 * without edits. Re-enable as a per-department engagement model later if needed.
 *
 * @returns {Promise<null>}
 */
async function recomputeLeadScore(_leadId) {
    return null;
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
