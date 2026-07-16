const jwt    = require("jsonwebtoken");
const prisma = require("../utils/prisma");
const { ERROR_CODES } = require("../utils/apiError");

// JWT proves identity — role is fetched fresh from DB so a role change by an
// admin takes effect on the very next request, not after token expiry (7 days).
// Token is read from httpOnly cookie (browser clients) or Authorization header (API clients).
const authMiddleware = async (req, res, next) => {
    const token =
        req.cookies?.token ||
        (req.headers.authorization?.startsWith("Bearer ")
            ? req.headers.authorization.slice(7)
            : null);

    if (!token) {
        return res.status(401).json({ error: { code: ERROR_CODES.AUTH_TOKEN_MISSING, message: "No token provided" } });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return res.status(401).json({ error: { code: ERROR_CODES.AUTH_TOKEN_INVALID, message: "Invalid or expired token" } });
    }

    try {
        const user = await prisma.user.findUnique({
            where:  { id: decoded.userId },
            select: { id: true, role: true, isActive: true, preferences: true },
        });
 
        if (!user || !user.isActive) {
            return res.status(401).json({ error: { code: ERROR_CODES.AUTH_ACCOUNT_INACTIVE, message: "Account not found or inactive" } });
        }
 
        // Keep all JWT claims (exp, iat, etc.) but override role with live DB value
        req.user = { ...decoded, role: user.role, preferences: user.preferences };
        next();
    } catch {
        res.status(500).json({ message: "Authentication check failed" });
    }
};

module.exports = authMiddleware;
