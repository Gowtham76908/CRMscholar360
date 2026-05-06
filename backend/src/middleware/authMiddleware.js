const jwt    = require("jsonwebtoken");
const prisma = require("../utils/prisma");

// JWT proves identity — role is fetched fresh from DB so a role change by an
// admin takes effect on the very next request, not after token expiry (7 days).
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return res.status(401).json({ message: "Invalid or expired token" });
    }

    try {
        const user = await prisma.user.findUnique({
            where:  { id: decoded.userId },
            select: { id: true, role: true, isActive: true },
        });

        if (!user || !user.isActive) {
            return res.status(401).json({ message: "Account not found or inactive" });
        }

        // Keep all JWT claims (exp, iat, etc.) but override role with live DB value
        req.user = { ...decoded, role: user.role };
        next();
    } catch {
        res.status(500).json({ message: "Authentication check failed" });
    }
};

module.exports = authMiddleware;
