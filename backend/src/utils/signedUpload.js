const jwt = require("jsonwebtoken");

// Sensitive upload subtrees that must not be publicly downloadable. Profile
// photos (avatars) are intentionally excluded — they're embedded as <img>
// across the app and carry no confidential data.
const GATED_PREFIXES = ["/uploads/recordings/", "/uploads/tasks/"];

const TTL_SECONDS = 12 * 60 * 60; // 12h — covers a work session; expiry just forces a re-sign on next data fetch

const isGatedPath = (relPath) =>
    typeof relPath === "string" && GATED_PREFIXES.some((p) => relPath.startsWith(p));

// Normalize to the path portion (drop any existing query/hash) so the signature
// always covers the bare file path, never a token-carrying URL.
const pathOnly = (relPath) => String(relPath).split(/[?#]/)[0];

/**
 * Returns the URL with a short-lived signed `token` query param appended, so a
 * cross-origin <audio>/<a> can fetch it without relying on third-party cookies.
 * Non-gated paths (avatars, external URLs) are returned unchanged.
 */
const signUploadUrl = (relPath) => {
    if (!isGatedPath(relPath)) return relPath;
    const p = pathOnly(relPath);
    const token = jwt.sign({ p }, process.env.JWT_SECRET, { expiresIn: TTL_SECONDS });
    return `${p}?token=${token}`;
};

/** True if `token` is a valid, unexpired signature for exactly `relPath`. */
const verifyUploadToken = (token, relPath) => {
    if (!token) return false;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded.p === pathOnly(relPath);
    } catch {
        return false;
    }
};

module.exports = { signUploadUrl, verifyUploadToken, isGatedPath };
