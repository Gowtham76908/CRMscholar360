const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { list, create, update, remove } = require("../controllers/emailTemplateController");

router.use(authMiddleware);

router.get("/",     list);
router.post("/",    create);
router.patch("/:id", update);
router.delete("/:id", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), remove);

module.exports = router;
