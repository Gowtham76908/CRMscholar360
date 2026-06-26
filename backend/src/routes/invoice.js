const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const {
    createInvoice,
    getInvoices,
    getInvoice,
    updateInvoice,
    deleteInvoice,
    sendEmail,
    addPayment,
    deletePayment,
    getBalanceSheet,
    getInvoiceStats,
} = require("../controllers/invoiceController");
const validate = require("../middleware/validate");
const { createInvoiceSchema, addPaymentSchema } = require("../middleware/schemas");

router.use(authMiddleware);

// All invoice access is privileged — financials are visible to ADMIN/SUPER_ADMIN
// (the sidebar already restricts the page to SUPER_ADMIN; managers may read via deal pages).
// Without this gate, EMPLOYEEs could list/read/aggregate any invoice in the system.
const READ_ROLES  = ["SUPER_ADMIN", "ADMIN", "TEAM_LEADER", "EMPLOYEE"];
const WRITE_ROLES = ["SUPER_ADMIN", "ADMIN", "TEAM_LEADER", "EMPLOYEE"];

router.get("/balance-sheet", roleMiddleware(READ_ROLES), getBalanceSheet);
router.get("/stats",         roleMiddleware(READ_ROLES), getInvoiceStats);
router.get("/",              roleMiddleware(READ_ROLES), getInvoices);
router.post("/", roleMiddleware(WRITE_ROLES), validate(createInvoiceSchema), createInvoice);
router.get("/:id",           roleMiddleware(READ_ROLES), getInvoice);
router.patch("/:id",         roleMiddleware(WRITE_ROLES), updateInvoice);
router.delete("/:id",        roleMiddleware(WRITE_ROLES), deleteInvoice);
router.post("/:id/send-email", roleMiddleware(WRITE_ROLES), sendEmail);
router.post("/:id/payments",   roleMiddleware(WRITE_ROLES), validate(addPaymentSchema), addPayment);
router.delete("/:id/payments/:paymentId", roleMiddleware(WRITE_ROLES), deletePayment);

module.exports = router;
