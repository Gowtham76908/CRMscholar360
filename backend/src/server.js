require("dotenv").config();
const app = require("./app");
const startScheduler = require("./scheduler");

const PORT = process.env.PORT || 5001;

// Start Background Jobs
startScheduler();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("Backend initialized at " + new Date().toISOString());
});
// Nodemon restart trigger
