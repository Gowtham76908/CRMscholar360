const { randomUUID } = require("crypto");
const prisma = require("../utils/prisma");
const { sendLeadEmail } = require("../services/emailService");

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

// Rewrite http(s) links in HTML to go through the click tracker
const injectTracking = (html, logId) => {
    // Rewrite href links (skip mailto, tel, and tracker itself)
    const tracked = html.replace(/href="(https?:\/\/[^"]+)"/gi, (match, url) => {
        if (url.includes("/email-track/")) return match;
        const encoded = encodeURIComponent(url);
        return `href="${BACKEND_URL}/api/email-track/click/${logId}?url=${encoded}"`;
    });

    // Append 1×1 tracking pixel before closing </body> or at the end
    const pixel = `<img src="${BACKEND_URL}/api/email-track/open/${logId}" width="1" height="1" alt="" style="border:0;display:block;width:1px;height:1px;" />`;

    return tracked.includes("</body>")
        ? tracked.replace("</body>", `${pixel}</body>`)
        : tracked + pixel;
};

// POST /api/leads/:id/emails
const sendEmail = async (req, res) => {
    try {
        const { id: leadId } = req.params;
        const { toEmail, subject, body } = req.body;
        const sentById = req.user.userId;

        if (!toEmail || !subject || !body) {
            return res.status(400).json({ message: "toEmail, subject, and body are required" });
        }

        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) return res.status(404).json({ message: "Lead not found" });

        const settings = await prisma.companySettings.findFirst();
        if (!settings?.smtpHost && !process.env.SMTP_HOST) {
            return res.status(400).json({ message: "SMTP is not configured. Go to Settings → Email to set it up." });
        }

        // Pre-generate the log ID so we can embed it in the email before saving
        const logId = randomUUID();
        const htmlBody = injectTracking(body.replace(/\n/g, "<br>"), logId);

        await sendLeadEmail({ to: toEmail, subject, body, html: htmlBody, settings });

        const log = await prisma.emailLog.create({
            data: { id: logId, leadId, toEmail, subject, body, sentById },
            include: { sentBy: { select: { id: true, name: true } } },
        });

        await prisma.activity.create({
            data: {
                leadId,
                userId: sentById,
                action: "EMAIL_SENT",
                metadata: { subject, toEmail },
            },
        });

        res.status(201).json(log);
    } catch (error) {
        console.error("[EMAIL SEND]", error.message);
        res.status(500).json({ message: "Failed to send email", error: error.message });
    }
};

// GET /api/leads/:id/emails
const getLeadEmails = async (req, res) => {
    try {
        const { id: leadId } = req.params;
        const emails = await prisma.emailLog.findMany({
            where: { leadId },
            include: { sentBy: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
        });
        res.json(emails);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch emails", error: error.message });
    }
};

module.exports = { sendEmail, getLeadEmails };
