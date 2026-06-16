const prisma = require("../utils/prisma");
const { isWonStage, isLostStage, getInitialStage } = require("../config/departmentWorkflows");

// Derived lead state from its department services (no global Lead.status):
//   open  — at least one service is not at a terminal (won/lost) stage
//   isNew — has a SALES service still at its initial stage (proxy for "untouched")
function deriveState(leadDepartments = []) {
    const open = leadDepartments.some(d => !isWonStage(d.department, d.stage) && !isLostStage(d.department, d.stage));
    const sales = leadDepartments.find(d => d.department === "SALES");
    const isNew = Boolean(sales && sales.stage === getInitialStage("SALES"));
    return { open, isNew };
}

// ─── Pattern Detectors ────────────────────────────────────────────────────────

function daysSince(date) {
    return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

function hoursSince(date) {
    return Math.floor((Date.now() - new Date(date).getTime()) / 3_600_000);
}

function detectNoActivity(lead) {
    const lastDate = lead.activities[0]?.createdAt ?? lead.createdAt;
    const days = daysSince(lastDate);
    if (days >= 7) return {
        type: "CALL", priority: "HIGH", icon: "phone",
        headline: "Lead going cold",
        detail: `No activity in ${days} days — act before it's lost`,
        ctaAction: "call", cta: "Call Now",
    };
    if (days >= 3) return {
        type: "FOLLOW_UP", priority: "MEDIUM", icon: "clock",
        headline: "Time for a follow-up",
        detail: `Last activity was ${days} days ago`,
        ctaAction: "note", cta: "Add Note",
    };
    return null;
}

function detectMissedCalls(lead) {
    const missed = lead.callLogs.filter(c => c.callStatus === "MISSED").length;
    if (missed >= 3) return {
        type: "WHATSAPP", priority: "HIGH", icon: "message",
        headline: `${missed} missed calls — switch to WhatsApp`,
        detail: "They're not picking up. Try a different channel.",
        ctaAction: "whatsapp", cta: "Send WhatsApp",
    };
    if (missed >= 1) return {
        type: "CALL", priority: "MEDIUM", icon: "phone",
        headline: `${missed} missed call${missed > 1 ? "s" : ""} — try again`,
        detail: "Schedule a callback at a better time",
        ctaAction: "call", cta: "Call Again",
    };
    return null;
}

function detectNeverContacted(lead) {
    if (!lead.isNew) return null;
    if (lead.callLogs.length > 0 || lead.notes.length > 0) return null;
    const hours = hoursSince(lead.createdAt);
    if (hours < 2) return null;
    const age = hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
    return {
        type: "CALL", priority: "HIGH", icon: "phone",
        headline: "First contact not made",
        detail: `Lead created ${age} with no calls or notes`,
        ctaAction: "call", cta: "Call Now",
    };
}

function detectOverdueTasks(lead) {
    const overdue = lead.tasks.filter(t => new Date(t.dueDate) < new Date());
    if (overdue.length === 0) return null;
    const extra = overdue.length > 1 ? ` +${overdue.length - 1} more` : "";
    return {
        type: "TASK", priority: "HIGH", icon: "check",
        headline: `${overdue.length} overdue task${overdue.length > 1 ? "s" : ""}`,
        detail: `"${overdue[0].title}"${extra}`,
        ctaAction: "tasks", cta: "View Tasks",
    };
}

function detectHighUrgency(lead) {
    if (!lead.open) return null;
    const last = lead.callLogs.find(c => c.isTranscribed);
    if (!last || last.urgency !== "High") return null;
    const days = daysSince(last.createdAt);
    if (days > 3) return null; // stale urgency signal — ignore
    return {
        type: "CALL", priority: "HIGH", icon: "alert",
        headline: "High urgency detected on last call",
        detail: "AI analysis flagged urgency — respond before they move on",
        ctaAction: "call", cta: "Call Now",
    };
}

function detectNegativeSentiment(lead) {
    const last = lead.callLogs.find(c => c.isTranscribed);
    if (!last) return null;
    const bad = last.sentiment === "Bad" || ["Frustrated", "Aggressive"].includes(last.tone);
    if (!bad) return null;
    const signal = last.tone ?? last.sentiment;
    return {
        type: "EMAIL", priority: "MEDIUM", icon: "mail",
        headline: "Friction on last call — try email",
        detail: `${signal} tone detected. Give them space and follow up in writing.`,
        ctaAction: "email", cta: "Send Email",
    };
}

function detectStuckInStatus(lead) {
    if (!lead.open) return null;
    const days = daysSince(lead.updatedAt);
    if (days < 5) return null;
    return {
        type: "FOLLOW_UP", priority: "MEDIUM", icon: "clock",
        headline: `No stage progress for ${days} days`,
        detail: "Consider advancing a department stage or taking action to move this forward",
        ctaAction: "note", cta: "Add Note",
    };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };

async function getSuggestionsForLead(leadId) {
    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
            callLogs:   { orderBy: { createdAt: "desc" }, take: 20 },
            notes:      { orderBy: { createdAt: "desc" }, take: 5 },
            tasks:      { where: { status: "PENDING" }, orderBy: { dueDate: "asc" } },
            activities: { orderBy: { createdAt: "desc" }, take: 1 },
            leadDepartments: { select: { department: true, stage: true } },
        },
    });

    if (!lead) return [];

    Object.assign(lead, deriveState(lead.leadDepartments));

    const detectors = [
        detectNeverContacted,
        detectHighUrgency,
        detectOverdueTasks,
        detectMissedCalls,
        detectNoActivity,
        detectNegativeSentiment,
        detectStuckInStatus,
    ];

    const suggestions = detectors
        .map(fn => fn(lead))
        .filter(Boolean)
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

    return suggestions;
}

module.exports = { getSuggestionsForLead };
