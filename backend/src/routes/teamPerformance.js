const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/authMiddleware");
const role    = require("../middleware/roleMiddleware");
const ctrl    = require("../controllers/teamPerformanceController");

router.use(auth);

const MANAGERS = ["SUPER_ADMIN", "ADMIN"];

router.get("/kpis",           role(MANAGERS), ctrl.getKPIs);
router.get("/lead-chart",     role(MANAGERS), ctrl.getLeadChart);
router.get("/employees",      role(MANAGERS), ctrl.getEmployeeTable);
router.get("/team-emails",    role(MANAGERS), ctrl.getTeamEmails);
router.get("/workforce",      role(MANAGERS), ctrl.getWorkforce);
router.get("/workload",       role(MANAGERS), ctrl.getWorkload);
router.get("/workflow-board",               role(MANAGERS), ctrl.getWorkflowBoard);
router.get("/workflow-board/:status/leads", role(MANAGERS), ctrl.getWorkflowColumnLeads);

router.get("/revenue-kpis",               role(MANAGERS), ctrl.getRevenueKPIs);
router.get("/revenue-trend",              role(MANAGERS), ctrl.getRevenueTrend);
router.get("/revenue-by-employee",        role(MANAGERS), ctrl.getRevenueByEmployee);
router.get("/revenue-by-source",          role(MANAGERS), ctrl.getRevenueBySource);
router.get("/revenue-by-manager",         role(MANAGERS), ctrl.getRevenueByManager);
router.get("/invoice-collection-trend",   role(MANAGERS), ctrl.getInvoiceCollectionTrend);
router.get("/revenue-employees",          role(MANAGERS), ctrl.getRevenueEmployeeTable);

module.exports = router;
