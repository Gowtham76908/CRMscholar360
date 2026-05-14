const express = require("express");
const router = express.Router();
const multer = require("multer");
const leadController = require("../controllers/leadController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const bulkController = require("../controllers/bulkController");
const validate = require("../middleware/validate");
const { createLeadSchema, updateLeadSchema, assignLeadSchema, mergeLeadsSchema, checkDuplicateSchema, bulkUpdateSchema, bulkAssignSchema } = require("../middleware/schemas");

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// All routes require authentication
router.use(authMiddleware);

// Bulk Actions
router.patch("/bulk-update", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), validate(bulkUpdateSchema), bulkController.bulkUpdateLeads);
router.patch("/bulk-assign", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), validate(bulkAssignSchema), bulkController.bulkAssignLeads);

// Get Lead Stats for Dashboard
router.get("/stats", leadController.getDashboardStats);

// Export Leads
router.get("/export", leadController.exportLeads);

// Import Leads from CSV (Admin only)
router.post("/import", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), csvUpload.single("csv"), leadController.importLeads);

// Check Duplicates
router.post("/check-duplicate", validate(checkDuplicateSchema), leadController.checkDuplicate);

// Merge Leads (Admin only)
router.post("/merge", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), validate(mergeLeadsSchema), leadController.mergeLeads);

// Get Lead Activities
router.get("/:id/activities", leadController.getLeadActivities);

// Smart follow-up suggestions
router.get("/:id/suggestions", leadController.getLeadSuggestions);
router.post("/:id/suggestions/dismiss", leadController.dismissLeadSuggestion);

// Get Single Lead (must come after all fixed-path GET routes to avoid shadowing /stats, /export)
router.get("/:id", leadController.getLead);

// Get all leads
router.get("/", leadController.getLeads);

// Create Lead (Super Admin & Admin Only)
router.post("/", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), validate(createLeadSchema), leadController.createLead);

// Assign Lead (Super Admin & Admin Only)
router.patch("/:id/assign", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), validate(assignLeadSchema), leadController.assignLead);

// Update Lead Status (e.g. Employee can update status)
router.patch("/:id/status", validate(updateLeadSchema), leadController.updateLead);

// Update entire Lead
router.put("/:id", validate(updateLeadSchema), leadController.updateLead);
router.patch("/:id", validate(updateLeadSchema), leadController.updateLead);

module.exports = router;
