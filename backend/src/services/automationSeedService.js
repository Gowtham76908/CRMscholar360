const prisma = require("../utils/prisma");

const DEFAULT_RULES = [
    {
        name: "New Lead — Welcome Journey",
        description: "When a new lead is created, send a welcome WhatsApp message (if phone exists), a welcome email (if email exists), and create a follow-up task for the assigned user.",
        triggerType: "LEAD_CREATED",
        triggerConfig: { constraints: [{ type: "PREVENT_DUPLICATES" }] },
        conditions: [],
        actions: [
            {
                type: "SEND_WHATSAPP",
                order: 0,
                config: {
                    templateName: "welcome_lead",
                    parameters: ["{{lead.name}}"],
                },
            },
            {
                type: "SEND_EMAIL",
                order: 1,
                config: {
                    subject: "Thanks for your enquiry!",
                    body: "Hi {{lead.name}},\n\nThank you for reaching out. Our team will get back to you within 24 hours.\n\nBest,\nThe Team",
                },
            },
            {
                type: "CREATE_TASK",
                order: 2,
                config: {
                    title: "Follow up with new lead",
                    description: "Initial follow-up for new lead created via automation.",
                    dueDaysFromNow: 1,
                    priority: "HIGH",
                },
            },
        ],
    },
    {
        name: "No Activity — Reminder & Notify Owner",
        description: "When a lead has had no activity for 3 days, create a follow-up reminder for the owner and send an in-app notification.",
        triggerType: "NO_ACTIVITY",
        triggerConfig: { days: 3 },
        conditions: [
            { field: "status", operator: "not_equals", value: "CONVERTED" },
        ],
        actions: [
            {
                type: "CREATE_REMINDER",
                order: 0,
                config: {
                    message: "No activity for 3 days — time to follow up.",
                    dueHoursFromNow: 2,
                },
            },
            {
                type: "SEND_NOTIFICATION",
                order: 1,
                config: {
                    title: "Lead going cold",
                    message: "A lead has had no activity for 3+ days. Follow up now.",
                },
            },
        ],
    },
    {
        name: "Missed Call — WhatsApp Follow-Up",
        description: "When a call is missed, send a WhatsApp template message and create a callback reminder.",
        triggerType: "MISSED_CALL",
        triggerConfig: { constraints: [{ type: "COOLDOWN", hours: 24 }] },
        conditions: [],
        actions: [
            {
                type: "SEND_WHATSAPP",
                order: 0,
                config: {
                    templateName: "missed_call_followup",
                    parameters: ["{{lead.name}}"],
                },
            },
            {
                type: "CREATE_REMINDER",
                order: 1,
                config: {
                    message: "Call back — missed call follow-up.",
                    dueHoursFromNow: 1,
                },
            },
        ],
    },
];

async function seedDefaultAutomations() {
    const results = [];

    for (const rule of DEFAULT_RULES) {
        const existing = await prisma.automationRule.findFirst({
            where: { name: rule.name },
        });
        if (existing) {
            results.push({ name: rule.name, status: "skipped" });
            continue;
        }

        await prisma.automationRule.create({
            data: {
                name: rule.name,
                description: rule.description,
                triggerType: rule.triggerType,
                triggerConfig: rule.triggerConfig,
                isActive: true,
                conditions: { create: rule.conditions },
                actions: { create: rule.actions },
            },
        });
        results.push({ name: rule.name, status: "created" });
    }

    return results;
}

module.exports = { seedDefaultAutomations };
