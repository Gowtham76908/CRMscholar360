const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/authMiddleware");
const role    = require("../middleware/roleMiddleware");
const ctrl    = require("../controllers/employeeReportController");

router.use(auth);

const MANAGERS = ["SUPER_ADMIN", "ADMIN"];

router.get("/:id/profile",       role(MANAGERS), ctrl.getProfile);
router.get("/:id/kpis",          role(MANAGERS), ctrl.getKPIs);
router.get("/:id/lead-chart",    role(MANAGERS), ctrl.getLeadChart);
router.get("/:id/tasks",         role(MANAGERS), ctrl.getTaskAnalytics);
router.get("/:id/activities",    role(MANAGERS), ctrl.getActivities);
router.get("/:id/communication", role(MANAGERS), ctrl.getCommunicationStats);
router.get("/:id/notes",         role(MANAGERS), ctrl.getNotes);
router.post("/:id/notes",        role(MANAGERS), ctrl.addNote);
router.delete("/notes/:noteId",  role(MANAGERS), ctrl.deleteNote);
router.get("/:id/productivity",              role(MANAGERS), ctrl.getProductivity);
router.get("/:id/funnel",                    role(MANAGERS), ctrl.getFunnel);
router.get("/:id/revenue-kpis",              role(MANAGERS), ctrl.getRevenueKPIs);
router.get("/:id/revenue-trend",             role(MANAGERS), ctrl.getRevenueTrend);
router.get("/:id/invoice-collection-trend",  role(MANAGERS), ctrl.getInvoiceCollectionTrend);

module.exports = router;
