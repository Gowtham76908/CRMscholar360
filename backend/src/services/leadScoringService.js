const prisma = require("../utils/prisma");

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

    const score = Math.max(0, Math.min(100,
        50 + deltas.reduce((sum, f) => sum + f.delta, 0)
    ));

    const factors = deltas
        .map(f => buildFactor(f.label, f.delta))
        .filter(Boolean);

    return { score, factors };
}

async function updateLeadScoreFromCall(leadId, transcriptionResult) {
    const { score, factors } = scoreFromTranscription(transcriptionResult);
    await prisma.lead.update({
        where: { id: leadId },
        data: { score, scoreExplanation: { factors, scoredAt: new Date().toISOString() } }
    });
    return score;
}

module.exports = { scoreFromTranscription, updateLeadScoreFromCall };
