const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const {
    listFields,
    createField,
    updateField,
    deleteField,
    saveLeadCustomFields,
} = require("../controllers/customFieldController");

router.use(authMiddleware);

// Field definitions (admin only for write)
router.get("/",            listFields);
router.post("/",           roleMiddleware(["SUPER_ADMIN"]), createField);
router.patch("/:id",       roleMiddleware(["SUPER_ADMIN"]), updateField);
router.delete("/:id",      roleMiddleware(["SUPER_ADMIN"]), deleteField);

// Lead custom-field values (any authenticated user can save)
router.patch("/leads/:leadId", saveLeadCustomFields);

module.exports = router;
