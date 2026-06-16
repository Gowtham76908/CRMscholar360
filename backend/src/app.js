const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const leadRoutes = require("./routes/lead");
const teamRoutes = require("./routes/team");
const noteRoutes = require("./routes/note");

const taskRoutes = require("./routes/task");
const integrationRoutes = require("./routes/integration");
const reminderRoutes = require("./routes/reminder");
const analyticsRoutes = require("./routes/analytics");
const commissionRoutes = require("./routes/commission");
const webhookRoutes = require("./routes/webhook");
const callLogRoutes = require("./routes/callLog");
const reportRoutes = require("./routes/report");
const exportRoutes = require("./routes/export");
const searchRoutes = require("./routes/search");
const searchLeadsRoutes = require("./routes/searchLeads");
const linkedinLeadsRoutes = require("./routes/linkedinLeads");
const sprintRoutes = require("./routes/sprint");
const auditRoutes = require("./routes/audit");
const sessionRoutes = require("./routes/session");

const app = express();

// Behind Render/Vercel proxies the client IP is in X-Forwarded-For. Trust the
// first proxy hop so req.ip (and rate-limit keys) reflect the real client.
app.set("trust proxy", 1);

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5000",
    "https://dcrm-testing.vercel.app",
    "https://dcrm-testing.onrender.com"
];

if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(helmet());
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const isAllowed = allowedOrigins.includes(origin) ||
                          (process.env.NODE_ENV !== "production" &&
                           /^https?:\/\/localhost(:\d+)?$/.test(origin));
        if (isAllowed) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
}));
// Capture raw body buffer so webhook signature middleware can verify HMAC-SHA256.
// Must be set up before express.json() consumes the stream.
app.use(express.json({
    verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files from uploads directory.
// Profile photos are avatars (low-sensitivity, embedded as <img> everywhere) → public.
// Call recordings and task files are confidential → gated by a signed token or session.
const uploadAccess = require("./middleware/uploadAccess");
app.use("/uploads/profiles",   express.static("uploads/profiles"));
app.use("/uploads/recordings", uploadAccess, express.static("uploads/recordings"));
app.use("/uploads/tasks",      uploadAccess, express.static("uploads/tasks"));
app.use("/uploads",            uploadAccess, express.static("uploads")); // catch-all: gate anything new by default

// Auth rate limit — 20 attempts per 15 minutes (login, etc.)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: "Too many login attempts. Please try again after 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use("/api/auth", authLimiter);

// Forgot-password: composite IP+email limiter (primary)
// express.json() runs before this so req.body.email is available.
// Falls back to IP-only if email is missing — never throws on empty body.
const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => {
        const email = (req.body?.email ?? "").toLowerCase().trim();
        const ip = (req.ip ?? "").replace(/^::ffff:/, ""); // normalise IPv4-mapped IPv6
        return email ? `${ip}:${email}` : ip;
    },
    validate: { keyGeneratorIpFallback: false }, // we normalise IPv6 manually above
    message: { error: "Too many reset requests. Please wait 15 minutes before trying again." },
    standardHeaders: true,
    legacyHeaders: false,
});

// Email-only limiter (secondary) — stops distributed attacks targeting one address
// across multiple IPs (e.g. botnet spraying reset requests at one victim email)
const forgotPasswordEmailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => (req.body?.email ?? "unknown").toLowerCase().trim(),
    validate: { ip: false },
    message: { error: "Too many reset requests for this email. Please wait 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => !(req.body?.email),
});

app.use("/api/auth/forgot-password", forgotPasswordLimiter, forgotPasswordEmailLimiter);

// Global API rate limit — blanket protection against scraping/abuse/DoS for any
// authenticated or public endpoint. Generous ceiling so normal 100-concurrent-user
// usage is never throttled; the stricter auth limiters above still apply on top.
// External ingestion paths (provider webhooks, public embed form, tracking pixel)
// are exempt — those legitimately burst from a single provider IP.
const RATE_EXEMPT = [
    "/api/webhooks",
    "/api/public",
    "/api/email-track",
    "/api/google-ads",
    "/api/google/callback",
];
const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 600, // per IP per minute
    message: { error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down." } },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        const path = req.originalUrl.split("?")[0];
        return RATE_EXEMPT.some((p) => path.startsWith(p));
    },
});
app.use("/api", globalLimiter);

app.get("/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/", (req, res) => {
    res.send("Backend is running...");
});

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────────────
// No authentication required. Do NOT add router.use(authMiddleware) inside
// these routers — they must remain open for unauthenticated callers.
app.use("/api/auth",        authRoutes);    // login, forgot-password, reset-password
app.use("/api/webhooks",    webhookRoutes); // external lead ingestion (no user session)
app.use("/api/demo-booking", require("./routes/demoBooking")); // public booking form

// Public, unauthenticated callers. These MUST be mounted before the catch-all
// note/task routers below (which apply authMiddleware at the bare "/api" mount and
// would otherwise 401 these): email open/click pixels, the Google Ads + website
// lead webhooks, and the Google OAuth callback.
app.use("/api/email-track",  require("./routes/emailTrack"));        // email open/click pixels
app.use("/api/google-ads",   require("./routes/googleAdsWebhook"));  // Google Ads lead webhook (key-verified)
app.use("/api/public/leads", require("./routes/publicLeads"));       // website embed form (API-key auth)
app.use("/api/google",       require("./routes/googleCalendar"));    // OAuth callback is public; other routes self-auth

// ─── PROTECTED ROUTES ─────────────────────────────────────────────────────────
// Every router listed here MUST call router.use(authMiddleware) at its top.
// Adding a new router? Ensure it starts with router.use(authMiddleware) before
// any route definitions — otherwise its endpoints will be publicly accessible.
app.use("/api/assistant",        require("./routes/assistant"));
app.use("/api/assistant-usage",  require("./routes/assistantUsage"));
app.use("/api/users",           userRoutes);
app.use("/api/leads",           leadRoutes);
app.use("/api/team",            teamRoutes);
app.use("/api",                 noteRoutes);
app.use("/api",                 taskRoutes);
app.use("/api/integrations",    integrationRoutes);
app.use("/api/reminders",       reminderRoutes);
app.use("/api/analytics",       analyticsRoutes);
app.use("/api/commission",      commissionRoutes);
app.use("/api/calls",           callLogRoutes);
app.use("/api/reports",         reportRoutes);
app.use("/api/export",          exportRoutes);
app.use("/api/search",          searchRoutes);
app.use("/api/search-leads",    searchLeadsRoutes);
app.use("/api/linkedin-leads",  linkedinLeadsRoutes);
app.use("/api/sprints",         sprintRoutes);
app.use("/api/audit-logs",      auditRoutes);
app.use("/api/sessions",        sessionRoutes);
app.use("/api/chat",            require("./routes/chat"));
app.use("/api/attendance",      require("./routes/attendance"));
app.use("/api/leave",           require("./routes/leave"));
app.use("/api/upload",          require("./routes/upload"));
app.use("/api/user-status",     require("./routes/userStatus"));
app.use("/api/invoices",        require("./routes/invoice"));
app.use("/api/fasterq",         require("./routes/fasterq"));
app.use("/api/company-settings", require("./routes/companySettings"));
app.use("/api/notifications",   require("./routes/notification"));
app.use("/api/automations",     require("./routes/automation"));
app.use("/api/whatsapp",        require("./routes/whatsapp"));
app.use("/api/ai",              require("./routes/ai"));
app.use("/api/custom-fields",   require("./routes/customField"));
app.use("/api/facebook",        require("./routes/facebook"));
app.use("/api/integration-hub", require("./routes/integrationHub"));
app.use("/api/organization",      require("./routes/organization"));
app.use("/api/team-performance", require("./routes/teamPerformance"));
app.use("/api/employee-report",  require("./routes/employeeReport"));
app.use("/api/deals",            require("./routes/deal"));
app.use("/api/email-templates",  require("./routes/emailTemplates"));
app.use("/api/leads/:id/journey", require("./routes/journey"));
app.use("/api/lead-departments", require("./routes/leadDepartment"));
// NOTE: public routers (email-track, google, google-ads, public/leads) are mounted
// in the PUBLIC section above — they must precede the catch-all note/task routers.

// Global error handler — must be last middleware
const { ApiError } = require("./utils/apiError");
const logger = require("./utils/logger");
app.use((err, req, res, _next) => {
    if (err instanceof ApiError) {
        if (err.status >= 500) logger.error({ method: req.method, url: req.url, code: err.code }, err.message);
        return res.status(err.status).json(err.toJSON());
    }
    logger.error({ method: req.method, url: req.url, err }, err.message || "Unhandled error");
    res.status(err.status || 500).json({
        error: { code: "INTERNAL_ERROR", message: "Something went wrong." },
    });
});

module.exports = app;
