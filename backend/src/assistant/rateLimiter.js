const prisma = require("../utils/prisma");
const logger = require("../utils/logger");
const { getAssistantSettings } = require("./settingsCache");

// Fixed-window per-user rate limit. In-memory, single-process — no Redis.
// If you ever run multiple Node instances behind a load balancer, the effective
// limit becomes LIMIT × instances; move to a shared store at that point.
const WINDOW_MS = 60_000;

// userId -> { count, windowStartedAt }
const buckets = new Map();

// Lazy eviction so a forgotten user doesn't keep a bucket around forever
const _sweep = () => {
    const now = Date.now();
    for (const [userId, b] of buckets) {
        if (now - b.windowStartedAt > WINDOW_MS * 5) buckets.delete(userId);
    }
};

const _check = (userId, limitValue) => {
    _sweep();
    const now = Date.now();
    let bucket = buckets.get(userId);

    if (!bucket || now - bucket.windowStartedAt >= WINDOW_MS) {
        bucket = { count: 0, windowStartedAt: now };
        buckets.set(userId, bucket);
    }

    const resetSeconds = Math.max(1, Math.ceil(((bucket.windowStartedAt + WINDOW_MS) - now) / 1000));

    if (bucket.count >= limitValue) {
        return { allowed: false, limit: limitValue, remaining: 0, resetSeconds };
    }

    bucket.count++;
    return { allowed: true, limit: limitValue, remaining: limitValue - bucket.count, resetSeconds };
};

const limit = async (req, res, next) => {
    const userId = req.user?.userId;
    if (!userId) return next(); // authMiddleware runs before us; defensive only

    const { rateLimit } = await getAssistantSettings();
    const result = _check(userId, rateLimit);
    res.setHeader("X-RateLimit-Limit",     result.limit);
    res.setHeader("X-RateLimit-Remaining", result.remaining);
    res.setHeader("X-RateLimit-Reset",     Math.floor(Date.now() / 1000) + result.resetSeconds);

    if (!result.allowed) {
        res.setHeader("Retry-After", result.resetSeconds);
        logger.warn(
            { userId, limit: result.limit, retryAfter: result.resetSeconds },
            "Assistant rate limit exceeded",
        );

        // Fire-and-forget log row so the dashboard can show rate-limit events.
        prisma.assistantRequestLog.create({
            data: {
                userId,
                status:    "RATE_LIMITED",
                inputMode: req.body?.inputMode === "voice" ? "voice" : "chat",
            },
        }).catch((err) => logger.warn({ err: err.message }, "Failed to log RATE_LIMITED"));

        return res.status(429).json({
            error: {
                type:    "RATE_LIMITED",
                message: `Rate limit of ${result.limit}/min reached. Try again in ${result.resetSeconds}s.`,
            },
        });
    }

    next();
};

module.exports = { limit };
