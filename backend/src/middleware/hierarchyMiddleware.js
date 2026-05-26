const { canAccessUser } = require("../services/permissionService");

/**
 * Middleware: ensures the requesting user has hierarchy access to the
 * target user identified by req.params.id (or req.params.userId).
 *
 * Usage:
 *   router.get("/:id/something", requireHierarchyAccess(), handler)
 */
const requireHierarchyAccess = () => async (req, res, next) => {
    const { userId, role } = req.user;
    const targetId = req.params.id || req.params.userId;

    if (!targetId) return next();

    try {
        const allowed = await canAccessUser(userId, role, targetId);
        if (!allowed) {
            return res.status(403).json({ message: "Access denied: outside your team hierarchy" });
        }
        next();
    } catch (err) {
        res.status(500).json({ message: "Hierarchy check failed" });
    }
};

module.exports = { requireHierarchyAccess };
