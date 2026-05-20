require("dotenv").config();
const http = require("http");
const app = require("./app");
const { initSocket } = require("./socket");
const startScheduler = require("./scheduler");
const { ensureIntegrationDefaults } = require("./controllers/integrationHubController");

const PORT = process.env.PORT || 5001;

const server = http.createServer(app);
initSocket(server);
startScheduler();

server.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("Backend initialized at " + new Date().toISOString());
    try {
        await ensureIntegrationDefaults();
        console.log("Integration defaults seeded (linkedin_serper auto-connected from env)");
    } catch (e) {
        console.warn("Could not seed integration defaults:", e.message);
    }
});
// Nodemon restart trigger
