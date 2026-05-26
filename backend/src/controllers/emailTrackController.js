const prisma = require("../utils/prisma");
const { ApiError } = require("../utils/apiError");

// 1x1 transparent GIF pixel
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

// GET /api/email-track/open/:id  (public, no auth)
const trackOpen = async (req, res, next) => {
    // Respond with pixel immediately — never block on DB
    res.writeHead(200, {
        "Content-Type":  "image/gif",
        "Content-Length": PIXEL.length,
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma":        "no-cache",
        "Expires":       "0",
    });
    res.end(PIXEL);

    try {
        await prisma.emailLog.updateMany({
            where: { id: req.params.id, openedAt: null },
            data:  { openedAt: new Date() },
        });
    } catch (e) {
        console.error("[TRACK OPEN]", e.message);
    }
};

// GET /api/email-track/click/:id?url=... (public, no auth)
const trackClick = async (req, res, next) => {
    const { id } = req.params;
    const { url } = req.query;

    if (!url) return res.status(400).send("Missing url");

    let decoded;
    try {
        decoded = decodeURIComponent(url);
        new URL(decoded); // validate it's a proper URL
    } catch {
        return res.status(400).send("Invalid url");
    }

    res.redirect(302, decoded);

    try {
        await prisma.emailLog.update({
            where: { id },
            data:  { clickCount: { increment: 1 }, lastClickedAt: new Date() },
        });
    } catch (e) {
        console.error("[TRACK CLICK]", e.message);
    }
};

module.exports = { trackOpen, trackClick };
