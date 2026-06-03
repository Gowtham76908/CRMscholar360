const prisma = require("../utils/prisma");
const { createTransporter } = require("../services/emailService");
const { invalidateAssistantSettings } = require("../assistant/settingsCache");

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

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

const SENSITIVE_FIELDS = ["smtpPass", "accountNo", "ifsc", "bankName", "gstin"];

function stripSensitive(settings) {
    const safe = { ...settings };
    for (const field of SENSITIVE_FIELDS) delete safe[field];
    return safe;
}

const getSettings = async (req, res, next) => {
    try {
        let settings = await prisma.companySettings.findFirst();
        if (!settings) {
            settings = await prisma.companySettings.create({ data: DEFAULT_SETTINGS });
        }
        const isPrivileged = req.user?.role === "SUPER_ADMIN";
        res.json(isPrivileged ? settings : stripSensitive(settings));
    } catch (error) {
        return next(error);
    }
};

const ALLOWED_UPDATE_FIELDS = [
    "companyName", "shortName", "gstin", "address", "city", "state", "pincode",
    "phone", "email", "website", "placeOfSupply", "bankName", "accountNo", "ifsc",
    "branch", "defaultTaxRate", "defaultNotes", "logoUrl", "currency",
    "smtpHost", "smtpPort", "smtpUser", "smtpPass", "smtpSecure", "smtpFrom",
    "slaWarningDays", "slaBreachDays",
    "assistantEnabled", "assistantRateLimitPerMin", "assistantMaxHistoryTurns",
];

const updateSettings = async (req, res, next) => {
    try {
        const data = {};
        for (const field of ALLOWED_UPDATE_FIELDS) {
            if (req.body[field] !== undefined) data[field] = req.body[field];
        }

        // Clamp / coerce assistant fields so a bad UI input can't break the runtime.
        if (data.assistantEnabled !== undefined) {
            data.assistantEnabled = Boolean(data.assistantEnabled);
        }
        if (data.assistantRateLimitPerMin !== undefined) {
            data.assistantRateLimitPerMin = clamp(parseInt(data.assistantRateLimitPerMin, 10) || 30, 1, 600);
        }
        if (data.assistantMaxHistoryTurns !== undefined) {
            data.assistantMaxHistoryTurns = clamp(parseInt(data.assistantMaxHistoryTurns, 10) || 6, 0, 50);
        }

        const touchedAssistant = ["assistantEnabled", "assistantRateLimitPerMin", "assistantMaxHistoryTurns"]
            .some((k) => data[k] !== undefined);

        let settings = await prisma.companySettings.findFirst();
        if (!settings) {
            settings = await prisma.companySettings.create({ data: { ...DEFAULT_SETTINGS, ...data } });
        } else {
            settings = await prisma.companySettings.update({
                where: { id: settings.id },
                data,
            });
        }

        if (touchedAssistant) invalidateAssistantSettings();

        res.json(settings);
    } catch (error) {
        return next(error);
    }
};

const testSmtp = async (req, res, next) => {
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
        return next(error);
    }
};

module.exports = { getSettings, updateSettings, testSmtp };
