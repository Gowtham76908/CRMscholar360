const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const gc = require("../controllers/googleCalendarController");

// Public callback — Google redirects here with ?code=...&state=userId
router.get("/callback", gc.handleCallback);

// All other routes require auth
router.use(authMiddleware);

router.get("/auth",              gc.initiateAuth);
router.get("/calendar/status",   gc.getStatus);
router.post("/calendar/disconnect", gc.disconnect);
router.get("/calendar/events",   gc.listEvents);
router.post("/calendar/events",  gc.createEvent);
router.delete("/calendar/events/:eventId", gc.deleteEvent);

module.exports = router;
