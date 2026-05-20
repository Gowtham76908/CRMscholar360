const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const c = require("../controllers/integrationHubController");

// OAuth callbacks are PUBLIC (browser redirected from provider — no session)
router.get("/oauth/:platform/callback", c.oauthCallback);

// All other routes require auth
router.use(auth);

router.get("/",                        c.getAll);
router.get("/:platform/oauth/start",   c.startOAuth);
router.put("/:platform/configure",     c.configure);
router.post("/:platform/test",         c.testConnection);
router.post("/:platform/sync",         c.sync);
router.delete("/:platform/disconnect", c.disconnect);
router.get("/:platform/logs",          c.getLogs);

module.exports = router;
