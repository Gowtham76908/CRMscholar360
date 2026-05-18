require("dotenv").config();
const http = require("http");
const app = require("./app");
const { initSocket } = require("./socket");
const startScheduler = require("./scheduler");

const PORT = process.env.PORT || 5001;

const server = http.createServer(app);
initSocket(server);
startScheduler();

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("Backend initialized at " + new Date().toISOString());
});
// Nodemon restart trigger
