const express = require("express");
const router = express.Router();
const departmentController = require("../controllers/departmentController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// Get All (Authenticated users needed for dropdown)
router.get("/", departmentController.getDepartments);
router.get("/:id", departmentController.getDepartmentById);

// Create & Delete (Admin/Super Admin only)
router.post("/", roleMiddleware(["SUPER_ADMIN"]), departmentController.createDepartment);
router.delete("/:id", roleMiddleware(["SUPER_ADMIN"]), departmentController.deleteDepartment);

module.exports = router;
