require("dotenv").config();
const http = require("http");
const app = require("./app");
const { initSocket } = require("./socket");
const startScheduler = require("./scheduler");
const { startScheduler: startLeadLoadScheduler } = require("./services/leadLoadScheduler");
const { ensureIntegrationDefaults } = require("./controllers/integrationHubController");
const { ensureSystemFields } = require("./controllers/customFieldController");

const PORT = process.env.PORT || 5001;

const server = http.createServer(app);
initSocket(server);

// Only one instance should run background jobs to prevent duplicate execution.
// Set SCHEDULER_ENABLED=false on all replica instances; leave unset (defaults true) on the primary.
if (process.env.SCHEDULER_ENABLED !== "false") {
    startScheduler();
    startLeadLoadScheduler();
    console.log("[Scheduler] Background jobs active on this instance.");
} else {
    console.log("[Scheduler] Disabled on this instance (SCHEDULER_ENABLED=false).");
}

server.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("Backend initialized at " + new Date().toISOString());
    try {
        await ensureIntegrationDefaults();
        console.log("Integration defaults seeded (linkedin_serper auto-connected from env)");
    } catch (e) {
        console.warn("Could not seed integration defaults:", e.message);
    }
    try {
        await ensureSystemFields();
        console.log("System custom fields seeded");
    } catch (e) {
        console.warn("Could not seed system fields:", e.message);
    }
});
// Nodemon restart trigger
