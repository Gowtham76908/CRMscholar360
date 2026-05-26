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

router.get("/balance-sheet", getBalanceSheet);
router.get("/stats", getInvoiceStats);
router.get("/", getInvoices);
router.post("/", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), validate(createInvoiceSchema), createInvoice);
router.get("/:id", getInvoice);
router.patch("/:id", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), updateInvoice);
router.delete("/:id", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), deleteInvoice);
router.post("/:id/send-email", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), sendEmail);
router.post("/:id/payments", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), validate(addPaymentSchema), addPayment);
router.delete("/:id/payments/:paymentId", roleMiddleware(["SUPER_ADMIN", "ADMIN"]), deletePayment);

module.exports = router;
