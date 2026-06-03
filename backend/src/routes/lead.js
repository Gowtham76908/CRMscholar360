const express = require("express");
const router = express.Router();
const multer = require("multer");
const leadController = require("../controllers/leadController");
const customFieldController = require("../controllers/customFieldController");
const emailController = require("../controllers/emailController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const bulkController = require("../controllers/bulkController");
const validate = require("../middleware/validate");
const { createLeadSchema, updateLeadSchema, assignLeadSchema, mergeLeadsSchema, checkDuplicateSchema, bulkUpdateSchema, bulkAssignSchema } = require("../middleware/schemas");
const { bulkSmartAssignLeads } = require("../controllers/bulkController");

const fileUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ok = /\.(csv|xlsx|xls)$/i.test(file.originalname);
        cb(ok ? null : new Error("Only CSV and Excel files are allowed"), ok);
    },
});

// All routes require authentication
router.use(authMiddleware);

// Bulk Actions
router.patch("/bulk-update", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), validate(bulkUpdateSchema), bulkController.bulkUpdateLeads);
router.patch("/bulk-assign", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), validate(bulkAssignSchema), bulkController.bulkAssignLeads);
router.post("/bulk-smart-assign", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), bulkSmartAssignLeads);

// Get Lead Stats for Dashboard
router.get("/stats",             leadController.getDashboardStats);
router.get("/overdue-followups", leadController.getOverdueFollowUps);
router.get("/sla-alerts",        leadController.getSLAAlerts);
router.get("/team-stats",        leadController.getTeamStats);
router.get("/duplicates",  roleMiddleware(["SUPER_ADMIN", "MANAGER"]), leadController.getDuplicates);

// Export Leads (admin/team_lead only — prevents bulk data leakage)
router.get("/export", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), leadController.exportLeads);

// Import Leads — preview (parse only, no DB writes), actual import, and status polling
router.post("/import/preview",        roleMiddleware(["SUPER_ADMIN", "MANAGER"]), fileUpload.single("file"), leadController.previewImport);
router.post("/import",                roleMiddleware(["SUPER_ADMIN", "MANAGER"]), fileUpload.single("file"), leadController.importLeads);
router.get("/import/status/:jobId",   roleMiddleware(["SUPER_ADMIN", "MANAGER"]), leadController.getImportStatus);

// Check Duplicates
router.post("/check-duplicate", validate(checkDuplicateSchema), leadController.checkDuplicate);

// Merge Leads (managers + super admin)
router.post("/merge", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), validate(mergeLeadsSchema), leadController.mergeLeads);

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
router.post("/", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), validate(createLeadSchema), leadController.createLead);

// Assign Lead
router.patch("/:id/assign", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), validate(assignLeadSchema), leadController.assignLead);

// Reassign Lead with history (Super Admin & Manager)
router.post("/:id/reassign", roleMiddleware(["SUPER_ADMIN", "MANAGER"]), leadController.reassignLead);

// Update Lead Status (e.g. Employee can update status)
router.patch("/:id/status", validate(updateLeadSchema), leadController.updateLead);

// Update entire Lead
router.put("/:id", validate(updateLeadSchema), leadController.updateLead);
router.patch("/:id", validate(updateLeadSchema), leadController.updateLead);

// Email
router.post("/:id/emails", emailController.sendEmail);
router.get("/:id/emails",  emailController.getLeadEmails);

// Custom field values for a specific lead
router.patch("/:id/custom-fields", (req, res) => {
    req.params.leadId = req.params.id;
    customFieldController.saveLeadCustomFields(req, res);
});

module.exports = router;
