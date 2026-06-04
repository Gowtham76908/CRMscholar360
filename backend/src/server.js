require("dotenv").config();
const validateEnv = require("./utils/validateEnv");
// Fail fast on missing critical config before anything else boots.
validateEnv();

const http = require("http");
const app = require("./app");
const logger = require("./utils/logger");
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
    logger.info("[Scheduler] Background jobs active on this instance.");
} else {
    logger.info("[Scheduler] Disabled on this instance (SCHEDULER_ENABLED=false).");
}

server.listen(PORT, async () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    try {
        await ensureIntegrationDefaults();
        logger.info("Integration defaults seeded (linkedin_serper auto-connected from env)");
    } catch (e) {
        logger.warn("Could not seed integration defaults: " + e.message);
    }
    try {
        await ensureSystemFields();
        logger.info("System custom fields seeded");
    } catch (e) {
        logger.warn("Could not seed system fields: " + e.message);
    }
});
// Nodemon restart trigger
