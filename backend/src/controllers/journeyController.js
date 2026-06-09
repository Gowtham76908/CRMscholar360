const prisma = require("../utils/prisma");
const { ApiError } = require("../utils/apiError");
const { istDateKey } = require("../utils/istTime");
const { signUploadUrl } = require("../utils/signedUpload");

// ── Access guard ──────────────────────────────────────────────────────────────

async function canViewLead(userId, role, lead) {
    if (role === "SUPER_ADMIN") return true;
    if (role === "MANAGER") {
        // manager sees their own + their team's leads
        const employees = await prisma.user.findMany({
            where: { managerId: userId },
            select: { id: true },
        });
        const teamIds = new Set([userId, ...employees.map(e => e.id)]);
        return teamIds.has(lead.assignedToId);
    }
    // EMPLOYEE — own leads only
    return lead.assignedToId === userId;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDuration = (secs) => {
    if (!secs) return null;
    const m = Math.floor(secs / 60), s = secs % 60;
    return `${m}m ${String(s).padStart(2, "0")}s`;
};

// ── Journey builder ───────────────────────────────────────────────────────────

async function buildJourneyEvents(leadId) {
    const [activities, calls, salestrailCalls, emails, waMessages, tasks, notes, assignments] =
        await Promise.all([
            prisma.activity.findMany({
                where: { leadId },
                include: { user: { select: { id: true, name: true } } },
                orderBy: { createdAt: "desc" },
            }),
            prisma.callLog.findMany({
                where: { leadId },
                orderBy: { createdAt: "desc" },
            }),
            prisma.salestrailCall.findMany({
                where: { leadId },
                orderBy: { createdAt: "desc" },
            }),
            prisma.emailLog.findMany({
                where: { leadId },
                include: { sentBy: { select: { id: true, name: true } } },
                orderBy: { createdAt: "desc" },
            }),
            prisma.whatsAppMessage.findMany({
                where: { leadId },
                include: { user: { select: { id: true, name: true } } },
                orderBy: { createdAt: "desc" },
            }),
            prisma.task.findMany({
                where: { leadId },
                include: { assignedTo: { select: { id: true, name: true } } },
                orderBy: { updatedAt: "desc" },
            }),
            prisma.note.findMany({
                where: { leadId },
                orderBy: { createdAt: "desc" },
            }),
            prisma.assignmentHistory.findMany({
                where: { leadId },
                include: {
                    employee: { select: { id: true, name: true } },
                    previousEmployee: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "desc" },
            }),
        ]);

    const events = [];

    // Activities (covers LEAD_CREATED, STATUS_CHANGED, LEAD_ASSIGNED, CALL_MADE, NOTE_ADDED, etc.)
    const activityEventTypes = new Set([
        "LEAD_CREATED", "STATUS_CHANGED", "LEAD_ASSIGNED", "LEAD_UPDATED",
        "LEAD_MERGED", "REMINDER_SET", "TASK_CREATED", "TASK_COMPLETED",
        "CALL_MADE", "CALL_INITIATED", "CALL_COMPLETED",
        "DEAL_CREATED", "DEAL_UPDATED", "DEAL_STAGE_CHANGED",
        "INVOICE_CREATED", "INVOICE_UPDATED", "PAYMENT_RECEIVED",
    ]);
    for (const a of activities) {
        // Skip note activities — we surface notes separately from the Note table
        if (a.action === "NOTE_ADDED") continue;
        let type = a.action;
        let channel = null;
        if (["CALL_MADE","CALL_INITIATED","CALL_COMPLETED"].includes(a.action)) channel = "call";
        else if (a.action === "STATUS_CHANGED") channel = "status";
        else if (["LEAD_ASSIGNED","LEAD_CREATED"].includes(a.action)) channel = "assignment";
        else if (a.action === "REMINDER_SET") channel = "reminder";
        else if (["TASK_CREATED","TASK_COMPLETED"].includes(a.action)) channel = "task";
        else if (["DEAL_CREATED","DEAL_UPDATED","DEAL_STAGE_CHANGED"].includes(a.action)) channel = "deal";
        else if (["INVOICE_CREATED","INVOICE_UPDATED","PAYMENT_RECEIVED"].includes(a.action)) channel = "invoice";
        else channel = "activity";

        events.push({
            id: `activity-${a.id}`,
            type,
            channel,
            referenceId: a.id,
            title: buildActivityTitle(a),
            description: buildActivityDescription(a),
            actor: a.user?.name ?? null,
            metadata: a.metadata ?? {},
            createdAt: a.createdAt,
        });
    }

    // CallLogs (avoid duplicates from activities by using a different ID prefix)
    for (const c of calls) {
        const isOutbound = c.callType === "OUTBOUND";
        events.push({
            id: `call-${c.id}`,
            type: isOutbound ? "CALL_MADE" : "CALL_RECEIVED",
            channel: "call",
            referenceId: c.id,
            title: isOutbound ? "Call made" : "Call received",
            description: [
                c.callStatus && `Status: ${c.callStatus}`,
                c.duration && `Duration: ${fmtDuration(c.duration)}`,
                c.summary,
            ].filter(Boolean).join(" · ") || null,
            actor: null,
            metadata: {
                duration: c.duration,
                callStatus: c.callStatus,
                callType: c.callType,
                summary: c.summary,
                tone: c.tone,
                outcome: c.callCategory,
                recordingUrl: signUploadUrl(c.recordingUrl),
            },
            createdAt: c.createdAt,
        });
    }

    // SalestrailCalls
    for (const c of salestrailCalls) {
        events.push({
            id: `stcall-${c.id}`,
            type: c.direction === "incoming" ? "CALL_RECEIVED" : "CALL_MADE",
            channel: "call",
            referenceId: c.id,
            title: c.direction === "incoming" ? "Call received (Salestrail)" : "Call made (Salestrail)",
            description: [
                c.agentName && `Agent: ${c.agentName}`,
                c.duration && `Duration: ${fmtDuration(c.duration)}`,
                c.notes,
            ].filter(Boolean).join(" · ") || null,
            actor: c.agentName ?? null,
            metadata: {
                duration: c.duration,
                status: c.status,
                agentName: c.agentName,
                recordingUrl: signUploadUrl(c.recordingUrl),
            },
            createdAt: c.createdAt,
        });
    }

    // Emails
    for (const e of emails) {
        events.push({
            id: `email-${e.id}`,
            type: "EMAIL_SENT",
            channel: "email",
            referenceId: e.id,
            title: "Email sent",
            description: e.subject,
            actor: e.sentBy?.name ?? null,
            metadata: {
                subject: e.subject,
                toEmail: e.toEmail,
                openedAt: e.openedAt,
                clickCount: e.clickCount,
            },
            createdAt: e.createdAt,
        });
    }

    // WhatsApp
    for (const m of waMessages) {
        const isSent = m.direction === "OUTBOUND";
        events.push({
            id: `wa-${m.id}`,
            type: isSent ? "WHATSAPP_SENT" : "WHATSAPP_RECEIVED",
            channel: "whatsapp",
            referenceId: m.id,
            title: isSent ? "WhatsApp sent" : "WhatsApp received",
            description: m.messageBody?.slice(0, 120) ?? null,
            actor: isSent ? (m.user?.name ?? null) : null,
            metadata: {
                direction: m.direction,
                status: m.status,
                templateName: m.templateName,
                preview: m.messageBody?.slice(0, 200),
            },
            createdAt: m.sentAt ?? m.createdAt,
        });
    }

    // Tasks
    for (const t of tasks) {
        events.push({
            id: `task-created-${t.id}`,
            type: "TASK_CREATED",
            channel: "task",
            referenceId: t.id,
            title: "Task created",
            description: t.title,
            actor: t.assignedTo?.name ?? null,
            metadata: { title: t.title, priority: t.priority, dueDate: t.dueDate, status: t.status },
            createdAt: t.updatedAt, // use updatedAt as proxy for creation
        });
        if (t.status === "COMPLETED" && t.completedAt) {
            events.push({
                id: `task-done-${t.id}`,
                type: "TASK_COMPLETED",
                channel: "task",
                referenceId: t.id,
                title: "Task completed",
                description: t.title,
                actor: t.assignedTo?.name ?? null,
                metadata: { title: t.title, completedAt: t.completedAt },
                createdAt: t.completedAt,
            });
        }
    }

    // Notes (from Note table — raw notes not in activities)
    for (const n of notes) {
        events.push({
            id: `note-${n.id}`,
            type: "NOTE_ADDED",
            channel: "note",
            referenceId: n.id,
            title: "Note added",
            description: n.content?.slice(0, 200),
            actor: null,
            metadata: { content: n.content },
            createdAt: n.createdAt,
        });
    }

    // Assignment history — supplement activity LEAD_ASSIGNED entries
    for (const h of assignments) {
        events.push({
            id: `assign-${h.id}`,
            type: "LEAD_ASSIGNED",
            channel: "assignment",
            referenceId: h.id,
            title: "Lead assigned",
            description: h.previousEmployee
                ? `From ${h.previousEmployee.name} → ${h.employee.name}`
                : `Assigned to ${h.employee.name}`,
            actor: null,
            metadata: {
                assignedTo: h.employee.name,
                previousEmployee: h.previousEmployee?.name ?? null,
                reason: h.reason,
            },
            createdAt: h.createdAt,
        });
    }

    // Sort newest first, deduplicate by id
    const seen = new Set();
    const unique = events.filter(e => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
    });
    unique.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return unique;
}

function buildActivityTitle(a) {
    const map = {
        LEAD_CREATED:    "Lead created",
        LEAD_UPDATED:    "Lead updated",
        STATUS_CHANGED:  "Status changed",
        LEAD_ASSIGNED:   "Lead assigned",
        LEAD_MERGED:     "Lead merged",
        REMINDER_SET:    "Reminder set",
        TASK_CREATED:    "Task created",
        TASK_COMPLETED:  "Task completed",
        CALL_MADE:       "Call made",
        CALL_INITIATED:  "Call initiated",
        CALL_COMPLETED:  "Call completed",
        DEAL_CREATED:    "Deal created",
        DEAL_UPDATED:    "Deal updated",
        DEAL_STAGE_CHANGED: "Deal stage changed",
        INVOICE_CREATED: "Invoice created",
        INVOICE_UPDATED: "Invoice updated",
        PAYMENT_RECEIVED: "Payment received",
    };
    return map[a.action] ?? a.action.replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

function buildActivityDescription(a) {
    const m = a.metadata ?? {};
    if (a.action === "STATUS_CHANGED") {
        const from = m.prevStatus?.replace("_", " ");
        const to = (m.newStatus ?? m.status)?.replace("_", " ");
        if (from && to) return `${from} → ${to}`;
        if (to) return `→ ${to}`;
    }
    if (a.action === "LEAD_ASSIGNED") return m.assignedTo ? `Assigned to ${m.assignedTo}` : null;
    if (a.action === "DEAL_CREATED") return m.title ? `${m.title}${m.amount ? ` · ₹${Number(m.amount).toLocaleString("en-IN")}` : ""}` : null;
    if (a.action === "DEAL_STAGE_CHANGED") return m.from && m.to ? `${m.from} → ${m.to}` : null;
    if (a.action === "DEAL_UPDATED") return m.title ?? null;
    if (a.action === "INVOICE_CREATED") return m.invoiceNumber ? `${m.invoiceNumber}${m.amount ? ` · ₹${Number(m.amount).toLocaleString("en-IN")}` : ""}` : null;
    if (a.action === "INVOICE_UPDATED") return m.invoiceNumber ?? null;
    if (a.action === "PAYMENT_RECEIVED") return m.invoiceNumber ? `${m.invoiceNumber} · ₹${Number(m.amount || 0).toLocaleString("en-IN")} received` : null;
    return m.note ?? m.details ?? null;
}

// ── Stats builder ─────────────────────────────────────────────────────────────

function buildStats(events, lead) {
    const byChannel = { call: 0, email: 0, whatsapp: 0, task: 0, note: 0, other: 0 };
    for (const e of events) {
        if (byChannel[e.channel] !== undefined) byChannel[e.channel]++;
        else byChannel.other++;
    }

    const createdAt = new Date(lead.createdAt);
    const now = new Date();
    const daysActive = Math.max(0, Math.ceil((now - createdAt) / 86_400_000));

    const contactEvents = events.filter(e =>
        ["call", "email", "whatsapp"].includes(e.channel)
    );
    const firstContact = contactEvents.length
        ? contactEvents[contactEvents.length - 1].createdAt
        : null;
    const lastContact = contactEvents.length
        ? contactEvents[0].createdAt
        : null;

    // Response rate: inbound messages / total messages (channels with direction)
    const waEvents = events.filter(e => e.channel === "whatsapp");
    const inbound = waEvents.filter(e => e.type === "WHATSAPP_RECEIVED").length;
    const responseRate = waEvents.length > 0
        ? Math.round((inbound / waEvents.length) * 100)
        : null;

    const totalInteractions = byChannel.call + byChannel.email + byChannel.whatsapp;

    const followUps = events.filter(e =>
        e.type === "TASK_COMPLETED" || e.type === "FOLLOWUP_DONE"
    ).length;

    return {
        totalInteractions,
        calls: byChannel.call,
        emails: byChannel.email,
        whatsapp: byChannel.whatsapp,
        tasks: byChannel.task,
        notes: byChannel.note,
        daysActive,
        responseRate,
        firstContact,
        lastContact,
        followUps,
    };
}

// ── Insights builder ──────────────────────────────────────────────────────────

function buildInsights(events, stats, lead) {
    const insights = [];
    const now = Date.now();

    // 1. Not contacted recently
    if (stats.lastContact) {
        const daysSince = Math.floor((now - new Date(stats.lastContact)) / 86_400_000);
        if (daysSince >= 3) {
            insights.push({
                level: "warning",
                text: `Lead has not been contacted in ${daysSince} day${daysSince > 1 ? "s" : ""}`,
            });
        }
    } else if (stats.daysActive >= 2) {
        insights.push({ level: "warning", text: "Lead has never been contacted" });
    }

    // 2. Preferred channel
    const channelCounts = { call: stats.calls, email: stats.emails, whatsapp: stats.whatsapp };
    const sorted = Object.entries(channelCounts).sort((a, b) => b[1] - a[1]);
    if (sorted[0][1] > 0) {
        const preferred = sorted[0][0];
        const labels = { call: "phone calls", email: "email", whatsapp: "WhatsApp" };
        if (sorted[0][1] > 1) {
            insights.push({ level: "info", text: `Lead mostly communicates via ${labels[preferred]}` });
        }
    }

    // 3. Frequency increasing
    const recentEvents = events.filter(e =>
        ["call","email","whatsapp"].includes(e.channel) &&
        new Date(e.createdAt) > new Date(now - 7 * 86_400_000)
    );
    const olderEvents = events.filter(e =>
        ["call","email","whatsapp"].includes(e.channel) &&
        new Date(e.createdAt) > new Date(now - 14 * 86_400_000) &&
        new Date(e.createdAt) <= new Date(now - 7 * 86_400_000)
    );
    if (recentEvents.length > olderEvents.length + 1 && recentEvents.length >= 2) {
        insights.push({ level: "info", text: "Communication frequency increasing in the last 7 days" });
    }

    // 4. High interaction but no conversion
    if (stats.totalInteractions >= 5 && lead.status !== "CONVERTED") {
        insights.push({ level: "warning", text: "High interaction count but lead not yet converted" });
    }

    // 5. Tasks pending
    const pendingTasks = events.filter(e => e.type === "TASK_CREATED" && e.metadata?.status === "PENDING");
    if (pendingTasks.length > 0) {
        insights.push({ level: "info", text: `${pendingTasks.length} pending task${pendingTasks.length > 1 ? "s" : ""} on this lead` });
    }

    return insights;
}

// ── Controllers ───────────────────────────────────────────────────────────────

const getJourney = async (req, res, next) => {
    const { id } = req.params;
    const { userId, role } = req.user;
    const { filter, search, page: rawPage } = req.query;
    const page = Math.max(1, parseInt(rawPage, 10) || 1);
    const PAGE_SIZE = 30;

    try {
        const lead = await prisma.lead.findUnique({
            where: { id },
            include: { assignedTo: { select: { id: true, name: true } } },
        });
        if (!lead) return res.status(404).json({ message: "Lead not found" });

        const allowed = await canViewLead(userId, role, lead);
        if (!allowed) return res.status(403).json({ message: "Access denied" });

        const allEvents = await buildJourneyEvents(id);
        const stats = buildStats(allEvents, lead);
        const insights = buildInsights(allEvents, stats, lead);
        let events = allEvents;

        // Filter by channel
        if (filter && filter !== "all") {
            const CHANNEL_MAP = {
                call: "call", email: "email", whatsapp: "whatsapp",
                task: "task", status: "status", reminder: "reminder",
                assignment: "assignment", note: "note",
            };
            const ch = CHANNEL_MAP[filter];
            if (ch) events = events.filter(e => e.channel === ch);
        }

        // Search
        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            events = events.filter(e =>
                (e.title && e.title.toLowerCase().includes(q)) ||
                (e.description && e.description.toLowerCase().includes(q)) ||
                (e.actor && e.actor.toLowerCase().includes(q))
            );
        }

        const total = events.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const paged = events.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

        // Group by day for display
        const grouped = [];
        let currentDay = null;
        for (const e of paged) {
            const day = new Date(e.createdAt).toDateString();
            if (day !== currentDay) {
                grouped.push({ day: e.createdAt, events: [] });
                currentDay = day;
            }
            grouped[grouped.length - 1].events.push(e);
        }

        // Interaction trend: last 14 days
        const trend = buildInteractionTrend(allEvents);

        res.json({
            lead: {
                id: lead.id,
                name: lead.name,
                score: lead.score,
                status: lead.status,
                source: lead.source,
                assignedTo: lead.assignedTo,
                createdAt: lead.createdAt,
            },
            stats,
            insights,
            trend,
            groups: grouped,
            pagination: { page, totalPages, total, pageSize: PAGE_SIZE },
        });
    } catch (err) {
        return next(err);
    }
};

function buildInteractionTrend(events) {
    const now = new Date();
    const days = [];
    for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = istDateKey(d);
        const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
        const count = events.filter(e =>
            ["call","email","whatsapp"].includes(e.channel) &&
            istDateKey(e.createdAt) === key
        ).length;
        days.push({ label, date: key, count });
    }
    return days;
}

module.exports = { getJourney };
