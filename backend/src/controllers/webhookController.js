const prisma = require("../utils/prisma");
const calculateLeadScore = require("../utils/leadScorer");
const logActivity = require("../utils/activityLogger");
const emailService = require("../services/emailService");

// Handle Incoming Webhook for Lead Creation
const handleLeadWebhook = async (req, res, next) => {
    try {
        const { source, name, email, phone, enquiryType, metadata } = req.body;

        // Basic validation
        if (!name || !phone) {
            return res.status(400).json({ message: "Name and Phone are required" });
        }

        // Validate Source
        const validSources = ["FACEBOOK", "INSTAGRAM", "GMAIL", "WEBSITE", "PHONE_CALL"];
        const leadSource = validSources.includes(source) ? source : "WEBSITE"; // Default to WEBSITE

        // Scoring
        const { score, category } = calculateLeadScore({ source: leadSource, phone, email });

        // Check for duplicates (Simple check)
        const existingLead = await prisma.lead.findFirst({
            where: {
                OR: [
                    { email: email || undefined },
                    { phone: phone }
                ]
            }
        });

        if (existingLead) {
            console.log(`[Webhook] Duplicate lead detected: ${email || phone}`);
            // Optionally update the existing lead or just log activity
            await logActivity({
                leadId: existingLead.id,
                action: "WEBHOOK_DUPLICATE_HIT",
                metadata: { source, receivedData: req.body }
            });
            return res.status(200).json({ message: "Lead already exists", leadId: existingLead.id });
        }

        // Create Lead
        const newLead = await prisma.lead.create({
            data: {
                name,
                email,
                phone,
                source: leadSource,
                enquiryType: enquiryType || "SERVICES",
                score,
                category
            }
        });

        // Log Activity
        await logActivity({
            leadId: newLead.id,
            action: "LEAD_CREATED_VIA_WEBHOOK",
            metadata: { source, metadata }
        });

        // Trigger Auto-Reply (Welcome Email / WhatsApp)
        if (newLead.email) {
            await emailService.sendWelcomeEmail(newLead);
            console.log(`[Webhook] Auto-reply triggered for ${newLead.email}`);
        }

        res.status(201).json({ message: "Lead processed successfully", leadId: newLead.id });
    } catch (error) {

        return next(error);
    }
};

module.exports = { handleLeadWebhook };
