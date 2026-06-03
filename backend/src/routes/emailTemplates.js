const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { list, create, update, remove } = require("../controllers/emailTemplateController");

router.use(authMiddleware);

// Templates are a shared org resource: any user may read/use them, but only
// managers and super admins may create, edit, or delete them.
const MANAGE_ROLES = ["SUPER_ADMIN", "MANAGER"];

router.get("/",       list);
router.post("/",      roleMiddleware(MANAGE_ROLES), create);
router.patch("/:id",  roleMiddleware(MANAGE_ROLES), update);
router.delete("/:id", roleMiddleware(MANAGE_ROLES), remove);

module.exports = router;
