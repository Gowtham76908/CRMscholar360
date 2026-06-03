const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        // Zod 4 exposes issues on `.issues` (`.errors` was removed); fall back for safety.
        const issues = result.error.issues ?? result.error.errors ?? [];
        const errors = issues.map(e => `${e.path.join(".")}: ${e.message}`);
        return res.status(400).json({ message: errors[0] ?? "Invalid request", errors });
    }
    req.body = result.data;
    next();
};

module.exports = validate;
