const logger = require("../utils/logger");

// In-memory multi-turn history: userId -> { turns: [{user, assistant}], lastAccessedAt }
// No DB, no Redis — survives only as long as the Node process does.
const sessions = new Map();

const TTL_MS    = 30 * 60 * 1000; // 30 minutes idle → drop
const MAX_TURNS = Math.max(0, parseInt(process.env.ASSISTANT_MAX_HISTORY_TURNS, 10) || 6);

// Lazy eviction of stale sessions — called on each getSession, no setInterval needed
const _sweep = () => {
    const now = Date.now();
    let dropped = 0;
    for (const [userId, session] of sessions) {
        if (now - session.lastAccessedAt > TTL_MS) {
            sessions.delete(userId);
            dropped++;
        }
    }
    if (dropped > 0) logger.info({ dropped, remaining: sessions.size }, "Assistant context: swept stale sessions");
};

// Returns flat OpenAI-style message list: [{role:"user", content}, {role:"assistant", content}, ...]
const getSession = (userId) => {
    _sweep();
    const session = sessions.get(userId);
    if (!session) return [];
    session.lastAccessedAt = Date.now();
    const messages = [];
    for (const t of session.turns) {
        messages.push({ role: "user",      content: t.user });
        messages.push({ role: "assistant", content: t.assistant });
    }
    return messages;
};

// Append one completed exchange. Tool calls/results are deliberately NOT persisted —
// they bloat tokens, reference IDs that won't be valid next turn, and the LLM will
// re-call tools as needed. The assistant reply already summarizes what they found.
const addTurn = (userId, { userMessage, assistantMessage }) => {
    if (!userMessage || !assistantMessage || MAX_TURNS === 0) return;

    let session = sessions.get(userId);
    if (!session) {
        session = { turns: [], lastAccessedAt: Date.now() };
        sessions.set(userId, session);
    }
    session.turns.push({ user: userMessage, assistant: assistantMessage });
    if (session.turns.length > MAX_TURNS) {
        session.turns = session.turns.slice(-MAX_TURNS);
    }
    session.lastAccessedAt = Date.now();
};

const clearSession = (userId) => {
    sessions.delete(userId);
};

module.exports = { getSession, addTurn, clearSession };
