const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { getStatus, connect, disconnect, listForms, syncLeads } = require("../controllers/facebookController");

router.use(authMiddleware);

router.get("/status",       getStatus);
router.post("/connect",     roleMiddleware(["SUPER_ADMIN", "ADMIN"]), connect);
router.post("/disconnect",  roleMiddleware(["SUPER_ADMIN", "ADMIN"]), disconnect);
router.get("/forms",        roleMiddleware(["SUPER_ADMIN", "ADMIN"]), listForms);
router.post("/sync",        roleMiddleware(["SUPER_ADMIN", "ADMIN"]), syncLeads);

module.exports = router;
