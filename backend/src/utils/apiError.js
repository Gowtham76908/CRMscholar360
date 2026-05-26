// Structured error codes for programmatic handling on the frontend.
// Usage: throw new ApiError(400, "VALIDATION_ERROR", "Phone is required")
//        return res.status(e.status).json(e.toJSON())
// Or use the express error handler — just call next(new ApiError(...))

const CODES = {
    // Auth
    AUTH_INVALID_CREDENTIALS:  "AUTH_INVALID_CREDENTIALS",
    AUTH_ACCOUNT_INACTIVE:     "AUTH_ACCOUNT_INACTIVE",
    AUTH_TOKEN_MISSING:        "AUTH_TOKEN_MISSING",
    AUTH_TOKEN_INVALID:        "AUTH_TOKEN_INVALID",
    // Access
    ACCESS_DENIED:             "ACCESS_DENIED",
    NOT_FOUND:                 "NOT_FOUND",
    // Input
    VALIDATION_ERROR:          "VALIDATION_ERROR",
    DUPLICATE_ENTRY:           "DUPLICATE_ENTRY",
    // Business rules
    INVOICE_PAID_DELETE:       "INVOICE_PAID_DELETE",
    MERGE_SAME_LEAD:           "MERGE_SAME_LEAD",
    // Generic
    INTERNAL_ERROR:            "INTERNAL_ERROR",
};

class ApiError extends Error {
    constructor(status, code, message, details = null) {
        super(message);
        this.status  = status;
        this.code    = code;
        this.details = details;
    }

    toJSON() {
        const body = { code: this.code, message: this.message };
        if (this.details) body.details = this.details;
        return { error: body };
    }
}

module.exports = { ApiError, ERROR_CODES: CODES };
