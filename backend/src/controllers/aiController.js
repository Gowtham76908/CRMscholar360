const OpenAI = require("openai");
const crypto = require("crypto");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// In-memory cache: userId → { digest, hash, generatedAt }
const digestCache = new Map();
// Per-user call counter: userId → { count, windowStart }
const callCounters = new Map();

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_HOUR = 5;               // OpenAI calls per user per hour

function inputHash(payload) {
    return crypto.createHash("md5").update(JSON.stringify(payload)).digest("hex");
}

function checkRateLimit(userId) {
    const now = Date.now();
    const entry = callCounters.get(userId);
    if (!entry || now - entry.windowStart > 60 * 60 * 1000) {
        callCounters.set(userId, { count: 1, windowStart: now });
        return true;
    }
    if (entry.count >= MAX_PER_HOUR) return false;
    entry.count++;
    return true;
}

exports.getDigest = async (req, res) => {
    try {
        const {
            followUp = 0,
            overdueTasks = 0,
            pendingTasks = 0,
            upcomingReminders = 0,
            userName = "",
        } = req.body;

        const userId = req.user.id;
        const payload = { followUp, overdueTasks, pendingTasks, upcomingReminders };
        const hash = inputHash(payload);

        // Return cache if data is unchanged and still fresh
        const cached = digestCache.get(userId);
        if (cached && cached.hash === hash && Date.now() - cached.generatedAt < CACHE_TTL_MS) {
            return res.json({ digest: cached.digest, cached: true });
        }

        // Rate-limit before calling OpenAI
        if (!checkRateLimit(userId)) {
            if (cached) return res.json({ digest: cached.digest, cached: true });
            return res.json({
                digest: "Your briefing will refresh once your quota resets (hourly). Check back soon.",
                cached: false,
            });
        }

        const prompt = `You are a CRM assistant. Write a concise 2–3 sentence morning briefing for ${userName || "the user"} based on their workload. Be direct and actionable. Data: ${followUp} leads need follow-up, ${overdueTasks} tasks are overdue, ${pendingTasks} tasks pending, ${upcomingReminders} reminders scheduled. Keep it under 60 words. No bullet points.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 120,
            temperature: 0.7,
        });

        const digest = completion.choices[0].message.content.trim();
        digestCache.set(userId, { digest, hash, generatedAt: Date.now() });

        res.json({ digest, cached: false });
    } catch (err) {
        console.error("[AI Digest]", err.message);
        const cached = digestCache.get(req.user?.id);
        if (cached) return res.json({ digest: cached.digest, cached: true });
        res.status(500).json({ error: "AI digest temporarily unavailable." });
    }
};
