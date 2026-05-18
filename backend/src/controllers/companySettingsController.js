const prisma = require("../utils/prisma");
const { createTransporter } = require("../services/emailService");

const DEFAULT_SETTINGS = {
    companyName: "HEXITE TECHNOLOGIES PRIVATE LIMITED",
    shortName: "HXZ",
    gstin: "33AAHCH4159D1ZT",
    address: "No 98, Varadharajan Street Kaladipet",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "600019",
    phone: "+91 9994081905, 9566999018",
    email: "praveen@hexitetechnologies.com",
    website: "https://hexitetechnologies.com/",
    placeOfSupply: "33-Tamil Nadu",
    bankName: "Axis Bank",
    accountNo: "924020046598227",
    ifsc: "UTIB0001619",
    branch: "Thiruvottriyur",
    defaultTaxRate: 18,
    defaultNotes: "",
};

const getSettings = async (req, res) => {
    try {
        let settings = await prisma.companySettings.findFirst();
        if (!settings) {
            settings = await prisma.companySettings.create({ data: DEFAULT_SETTINGS });
        }
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: "Error fetching settings", error: error.message });
    }
};

const updateSettings = async (req, res) => {
    try {
        let settings = await prisma.companySettings.findFirst();
        if (!settings) {
            settings = await prisma.companySettings.create({ data: { ...DEFAULT_SETTINGS, ...req.body } });
        } else {
            settings = await prisma.companySettings.update({
                where: { id: settings.id },
                data: req.body,
            });
        }
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: "Error updating settings", error: error.message });
    }
};

const testSmtp = async (req, res) => {
    try {
        const { smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure, smtpFrom, testTo } = req.body;
        if (!smtpHost || !smtpUser || !smtpPass) {
            return res.status(400).json({ message: "smtpHost, smtpUser, and smtpPass are required" });
        }
        const transporter = createTransporter({ smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure });
        await transporter.verify();
        await transporter.sendMail({
            from: `"CRM Test" <${smtpUser}>`,
            to: testTo || smtpUser,
            subject: "SMTP Test — CRM Connection Successful",
            text: "Your SMTP settings are working correctly.",
        });
        res.json({ message: "Test email sent successfully" });
    } catch (error) {
        res.status(400).json({ message: "SMTP test failed", error: error.message });
    }
};

module.exports = { getSettings, updateSettings, testSmtp };
