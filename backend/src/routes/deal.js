const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
    createDeal, listDeals, getDeal, updateDeal, deleteDeal,
    getPipeline, getMembers, createInvoiceFromDeal, listDealInvoices,
} = require("../controllers/dealController");

router.use(authMiddleware);

// Static routes BEFORE /:id
router.get("/pipeline", getPipeline);
router.get("/members",  getMembers);

router.get("/",        listDeals);
router.post("/",       createDeal);
router.get("/:id",          getDeal);
router.patch("/:id",        updateDeal);
router.delete("/:id",       deleteDeal);
const verifyInvoiceAccess = (req, res, next) => {
    if (req.user.role === "SUPER_ADMIN") {
        return next();
    }
    const permissions = req.user.preferences?.permissions || {};
    if (permissions.invoice === false) {
        return res.status(403).json({ error: { message: "Access denied: invoice access is disabled for your account." } });
    }
    next();
};

router.get("/:id/invoices", verifyInvoiceAccess, listDealInvoices);
router.post("/:id/create-invoice", verifyInvoiceAccess, createInvoiceFromDeal);

module.exports = router;
