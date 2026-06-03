const logger = require("../utils/logger");
const { getAssistantSettings } = require("./settingsCache");

// In-memory multi-turn history: userId -> { turns: [{user, assistant}], lastAccessedAt }
// No DB, no Redis — survives only as long as the Node process does.
const sessions = new Map();

const TTL_MS = 30 * 60 * 1000; // 30 minutes idle → drop

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
const getSession = async (userId) => {
    _sweep();
    const session = sessions.get(userId);
    if (!session) return [];
    session.lastAccessedAt = Date.now();

    // Apply the current max-history cap on read too, so lowering it via settings
    // takes effect immediately without waiting for the next addTurn.
    const { maxHistoryTurns } = await getAssistantSettings();
    const turns = maxHistoryTurns === 0 ? [] : session.turns.slice(-maxHistoryTurns);

    const messages = [];
    for (const t of turns) {
        messages.push({ role: "user",      content: t.user });
        messages.push({ role: "assistant", content: t.assistant });
    }
    return messages;
};

// Append one completed exchange. Tool calls/results are deliberately NOT persisted —
// they bloat tokens, reference IDs that won't be valid next turn, and the LLM will
// re-call tools as needed. The assistant reply already summarizes what they found.
const addTurn = async (userId, { userMessage, assistantMessage }) => {
    if (!userMessage || !assistantMessage) return;

    const { maxHistoryTurns } = await getAssistantSettings();
    if (maxHistoryTurns === 0) return;

    let session = sessions.get(userId);
    if (!session) {
        session = { turns: [], lastAccessedAt: Date.now() };
        sessions.set(userId, session);
    }
    session.turns.push({ user: userMessage, assistant: assistantMessage });
    if (session.turns.length > maxHistoryTurns) {
        session.turns = session.turns.slice(-maxHistoryTurns);
    }
    session.lastAccessedAt = Date.now();
};

const clearSession = (userId) => {
    sessions.delete(userId);
};

module.exports = { getSession, addTurn, clearSession };
