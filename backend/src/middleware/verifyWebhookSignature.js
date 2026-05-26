const crypto = require("crypto");

/**
 * Express middleware that verifies the x-hub-signature-256 header sent by
 * Facebook / Meta and any other webhook callers that use the same HMAC-SHA256
 * scheme (Hub Signature v2).
 *
 * Requires:
 *   - WEBHOOK_SECRET env var to be set
 *   - express.json({ verify: (req, res, buf) => { req.rawBody = buf; } })
 *     to have run first so req.rawBody is available
 *
 * Returns 403 on missing or invalid signatures.
 */
function verifyWebhookSignature(req, res, next) {
    const secret = process.env.WEBHOOK_SECRET;

    // If no secret is configured, skip verification in development but warn loudly.
    if (!secret) {
        if (process.env.NODE_ENV === "production") {
            console.error("[Webhook] WEBHOOK_SECRET is not set — rejecting all webhook requests in production.");
            return res.status(403).json({ error: "Webhook secret not configured." });
        }
        console.warn("[Webhook] WEBHOOK_SECRET not set — signature verification skipped (non-production).");
        return next();
    }

    const signature = req.headers["x-hub-signature-256"];
    if (!signature) {
        console.warn(`[Webhook] Missing x-hub-signature-256 from ${req.ip}`);
        return res.status(403).json({ error: "Missing webhook signature." });
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
        console.error("[Webhook] req.rawBody is undefined — ensure express.json verify callback is configured.");
        return res.status(500).json({ error: "Internal configuration error." });
    }

    try {
        const hmac = crypto.createHmac("sha256", secret);
        hmac.update(rawBody);
        const expected = `sha256=${hmac.digest("hex")}`;

        // Constant-time comparison to prevent timing attacks
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
            console.warn(`[Webhook] Invalid signature from ${req.ip} — expected ${expected}, got ${signature}`);
            return res.status(403).json({ error: "Invalid webhook signature." });
        }

        next();
    } catch (err) {
        console.error("[Webhook] Signature verification error:", err.message);
        return res.status(403).json({ error: "Signature verification failed." });
    }
}

module.exports = verifyWebhookSignature;
