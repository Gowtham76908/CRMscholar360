const express = require("express");
const router = express.Router();
const multer = require("multer");
const leadController = require("../controllers/leadController");
const leadDepartmentController = require("../controllers/leadDepartmentController");
const customFieldController = require("../controllers/customFieldController");
const emailController = require("../controllers/emailController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const validate = require("../middleware/validate");
const { createLeadSchema, updateLeadSchema, mergeLeadsSchema, checkDuplicateSchema } = require("../middleware/schemas");

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

// Global bulk status/assign actions were retired with Lead.status/assignedToId.
// Bulk stage/consultant changes are per-department (see /lead-departments).

// Lead lists / alerts (department-scoped). Global status dashboards were retired
// in favour of per-department analytics (/lead-departments/dashboard).
router.get("/overdue-followups", leadController.getOverdueFollowUps);
router.get("/sla-alerts",        leadController.getSLAAlerts);
router.get("/duplicates",  roleMiddleware(["SUPER_ADMIN", "ADMIN", "TEAM_LEADER"]), leadController.getDuplicates);

// Export Leads (admin/team_lead only — prevents bulk data leakage)
router.get("/export", roleMiddleware(["SUPER_ADMIN", "ADMIN", "TEAM_LEADER"]), leadController.exportLeads);

// Import Leads — preview (parse only, no DB writes), actual import, and status polling
router.post("/import/preview",        roleMiddleware(["SUPER_ADMIN", "ADMIN", "TEAM_LEADER"]), fileUpload.single("file"), leadController.previewImport);
router.post("/import",                roleMiddleware(["SUPER_ADMIN", "ADMIN", "TEAM_LEADER"]), fileUpload.single("file"), leadController.importLeads);
router.get("/import/status/:jobId",   roleMiddleware(["SUPER_ADMIN", "ADMIN", "TEAM_LEADER"]), leadController.getImportStatus);

// Check Duplicates
router.post("/check-duplicate", validate(checkDuplicateSchema), leadController.checkDuplicate);

// Merge Leads (managers + super admin)
router.post("/merge", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), validate(mergeLeadsSchema), leadController.mergeLeads);

// Multi-department: a lead's department services.
// List is scoped to the actor; allocation authorization is enforced in the service
// (Director, Sales Manager, or the assigned Sales consultant).
router.get("/:id/departments", leadDepartmentController.listForLead);
router.post("/:id/departments", leadDepartmentController.allocate);

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

// Consultant/stage assignment is per-department: see /lead-departments/:id/assign
// and /lead-departments/:id/stage. Global lead assign/reassign/status endpoints removed.

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
