const authMiddleware = require("./authMiddleware");
const { verifyUploadToken } = require("../utils/signedUpload");

// Gate for sensitive upload subtrees (call recordings, task files). Access is
// granted by EITHER a valid signed `?token=` for the exact requested path
// (works cross-origin with no cookie — used by <audio>/<a> media elements),
// OR a normal authenticated session (cookie / Bearer) for same-origin/API use.
const uploadAccess = (req, res, next) => {
    // req.path is relative to the mount point (e.g. "/abc.mp3" under
    // /uploads/recordings), so use originalUrl for the full public path the
    // token was signed against. Strip the query string before comparing.
    const fullPath = req.originalUrl.split("?")[0];

    if (verifyUploadToken(req.query.token, fullPath)) {
        return next();
    }

    return authMiddleware(req, res, next);
};

module.exports = uploadAccess;
