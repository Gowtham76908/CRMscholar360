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
router.get("/:id/invoices", listDealInvoices);
router.post("/:id/create-invoice", createInvoiceFromDeal);

module.exports = router;
