const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/automationController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);
router.use(roleMiddleware(["SUPER_ADMIN"]));

router.get("/",             ctrl.getRules);
router.post("/",            ctrl.createRule);
router.post("/seed",        ctrl.seedRules);        // must be before /:id
router.patch("/:id/toggle", ctrl.toggleRule);
router.get("/:id/logs",     ctrl.getRuleLogs);
router.patch("/:id",        ctrl.updateRule);
router.delete("/:id",       ctrl.deleteRule);

module.exports = router;

 