const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

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

app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use("/uploads", express.static("uploads"));

// Auth rate limit — 20 attempts per 15 minutes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: "Too many login attempts. Please try again after 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use("/api/auth", authLimiter);

app.get("/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/", (req, res) => {
    res.send("Backend is running...");
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/team", teamRoutes);
app.use("/api", noteRoutes);
app.use("/api", taskRoutes);
app.use("/api/integrations", integrationRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/commission", commissionRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/calls", callLogRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/search-leads", searchLeadsRoutes);
app.use("/api/linkedin-leads", linkedinLeadsRoutes);
app.use("/api/sprints", sprintRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/departments", require("./routes/department"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/leave", require("./routes/leave"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/user-status", require("./routes/userStatus"));
app.use("/api/invoices", require("./routes/invoice"));
app.use("/api/salestrail", require("./routes/salestrail"));
app.use("/api/company-settings", require("./routes/companySettings"));
app.use("/api/demo-booking", require("./routes/demoBooking"));
app.use("/api/notifications", require("./routes/notification"));

// Global error handler — must be last middleware
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${req.method} ${req.url} —`, err.message);
    res.status(err.status || 500).json({
        error: err.message || "Something went wrong. Please try again.",
    });
});

module.exports = app;
