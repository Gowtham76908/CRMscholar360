const express = require("express");
const router = express.Router();
const multer = require("multer");
const leadController = require("../controllers/leadController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const bulkController = require("../controllers/bulkController");

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// All routes require authentication
router.use(authMiddleware);

// Bulk Actions
router.patch("/bulk-update", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), bulkController.bulkUpdateLeads);
router.patch("/bulk-assign", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), bulkController.bulkAssignLeads);

// Get Lead Stats for Dashboard
router.get("/stats", leadController.getDashboardStats);

// Export Leads
router.get("/export", leadController.exportLeads);

// Import Leads from CSV (Admin only)
router.post("/import", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), csvUpload.single("csv"), leadController.importLeads);

// Check Duplicates
router.post("/check-duplicate", leadController.checkDuplicate);

// Merge Leads (Admin only)
router.post("/merge", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), leadController.mergeLeads);

// Get Lead Activities
router.get("/:id/activities", leadController.getLeadActivities);

// Get all leads
router.get("/", leadController.getLeads);

// Create Lead (Super Admin & Admin Only)
router.post("/", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), leadController.createLead);

// Assign Lead (Super Admin & Admin Only)
router.patch("/:id/assign", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), leadController.assignLead);

// Update Lead Status (e.g. Employee can update status)
router.patch("/:id/status", leadController.updateLead);

// Update entire Lead
router.put("/:id", leadController.updateLead);
router.patch("/:id", leadController.updateLead);

module.exports = router;
