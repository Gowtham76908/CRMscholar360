const prisma = require("../utils/prisma");
const logActivity = require("../utils/activityLogger");

// ─── Condition Evaluator ──────────────────────────────────────────────────────

function getLeadField(lead, field) {
    const map = {
        source:     lead.source,
        status:     lead.status,
        assignedTo: lead.assignedToId,
        enquiryType: lead.enquiryType,
    };
    return map[field] ?? null;
}

function matchesCondition(lead, cond) {
    const val = getLeadField(lead, cond.field);
    switch (cond.operator) {
        case "equals":        return val === cond.value;
        case "not_equals":    return val !== cond.value;
        case "is_empty":      return !val;
        case "is_not_empty":  return !!val;
        default:              return false;
    }
}

function matchesAllConditions(lead, conditions) {
    return conditions.every(c => matchesCondition(lead, c));
}

// ─── Action Executor ──────────────────────────────────────────────────────────

async function executeAction(action, lead, childContext = {}) {
    const cfg = action.config;

    switch (action.type) {
        case "CHANGE_STATUS": {
            const updatedLead = await prisma.lead.update({
                where: { id: lead.id },
                data: { status: cfg.status }
            });
            await logActivity({
                leadId: lead.id,
                userId: null,
                action: "STATUS_CHANGED",
                metadata: { prevStatus: lead.status, newStatus: cfg.status, source: "automation" }
            });
            // Fire chained STATUS_CHANGED rules — depth guard prevents infinite loops
            runRulesForLead("STATUS_CHANGED", updatedLead, {
                ...childContext,
                prevStatus: lead.status,
                newStatus: cfg.status,
            }).catch(console.error);
            return { action: "CHANGE_STATUS", status: cfg.status };
        }

        case "ASSIGN_LEAD": {
            const updatedLead = await prisma.lead.update({
                where: { id: lead.id },
                data: { assignedToId: cfg.userId }
            });
            await logActivity({
                leadId: lead.id,
                userId: cfg.userId,
                action: "ASSIGNED",
                metadata: { assignedToId: cfg.userId, source: "automation" }
            });
            // Fire chained LEAD_ASSIGNED rules — depth guard prevents infinite loops
            runRulesForLead("LEAD_ASSIGNED", updatedLead, childContext).catch(console.error);
            return { action: "ASSIGN_LEAD", userId: cfg.userId };
        }

        case "CREATE_TASK": {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + (cfg.dueDaysFromNow ?? 1));
            await prisma.task.create({
                data: {
                    title: cfg.title,
                    description: cfg.description ?? null,
                    leadId: lead.id,
                    assignedToId: lead.assignedToId ?? null,
                    dueDate,
                    status: "PENDING",
                    priority: cfg.priority ?? "MEDIUM",
                }
            });
            await logActivity({
                leadId: lead.id,
                userId: null,
                action: "TASK_CREATED",
                metadata: { title: cfg.title, source: "automation" }
            });
            return { action: "CREATE_TASK", title: cfg.title };
        }

        case "CREATE_REMINDER": {
            if (!lead.assignedToId) return { action: "CREATE_REMINDER", skipped: true, reason: "no_assignee" };
            const remindAt = new Date();
            remindAt.setHours(remindAt.getHours() + (cfg.dueHoursFromNow ?? 24));
            await prisma.reminder.create({
                data: {
                    leadId: lead.id,
                    userId: lead.assignedToId,
                    message: cfg.message,
                    remindAt,
                }
            });
            return { action: "CREATE_REMINDER", message: cfg.message };
        }

        case "SEND_NOTIFICATION": {
            if (lead.assignedToId) {
                await prisma.notification.create({
                    data: {
                        userId: lead.assignedToId,
                        title: cfg.title ?? "Automation Alert",
                        message: cfg.message ?? `Action required on lead: ${lead.name}`,
                        link: `/leads/${lead.id}`,
                    }
                });
            }
            return { action: "SEND_NOTIFICATION", userId: lead.assignedToId };
        }

        default:
            return { action: action.type, skipped: true };
    }
}

// ─── Loop Guard ───────────────────────────────────────────────────────────────
// Automations that mutate a lead (e.g. CHANGE_STATUS) can re-fire the same
// trigger, creating an infinite loop. We pass _depth through context and bail
// if it exceeds MAX_AUTOMATION_DEPTH.  Depth 0 = user action, depth 1 =
// automation-triggered automation.  Depth 2+ is never allowed.

const MAX_AUTOMATION_DEPTH = 1;

// ─── Rule Runner ──────────────────────────────────────────────────────────────

async function runRulesForLead(triggerType, lead, context = {}) {
    const depth = context._depth ?? 0;
    if (depth > MAX_AUTOMATION_DEPTH) {
        // Log suppressed chain so it's visible in audit trail
        console.warn(
            `[AutomationEngine] Loop guard triggered: ${triggerType} on lead ${lead.id} at depth ${depth} — skipped`
        );
        return;
    }

    const rules = await prisma.automationRule.findMany({
        where: { triggerType, isActive: true },
        include: {
            conditions: true,
            actions: { orderBy: { order: "asc" } }
        }
    });

    for (const rule of rules) {
        // For STATUS_CHANGED trigger, check if the config status matches
        if (triggerType === "STATUS_CHANGED" && rule.triggerConfig?.status) {
            if (rule.triggerConfig.status !== context.newStatus) continue;
        }

        const conditionsMet = matchesAllConditions(lead, rule.conditions);
        if (!conditionsMet) {
            await prisma.automationLog.create({
                data: { ruleId: rule.id, leadId: lead.id, status: "SKIPPED", details: { reason: "conditions_not_met" } }
            });
            continue;
        }

        const results = [];
        let failed = false;
        // Carry depth so any automation-originated trigger sees depth+1
        const childContext = { _depth: depth + 1, _originRuleId: rule.id };

        for (const action of rule.actions) {
            try {
                const result = await executeAction(action, lead, childContext);
                results.push(result);
                // Re-fetch lead so subsequent actions see the updated state
                lead = await prisma.lead.findUnique({ where: { id: lead.id } });
            } catch (err) {
                failed = true;
                results.push({ action: action.type, error: err.message });
            }
        }

        await prisma.automationLog.create({
            data: {
                ruleId: rule.id,
                leadId: lead.id,
                status: failed ? "FAILED" : "SUCCESS",
                details: { results, context: { ...context, _depth: depth } }
            }
        });
    }
}

// ─── Time-based: No Activity trigger ─────────────────────────────────────────
// Called by a daily cron or scheduler
async function runNoActivityRules() {
    const rules = await prisma.automationRule.findMany({
        where: { triggerType: "NO_ACTIVITY", isActive: true },
        include: { conditions: true, actions: { orderBy: { order: "asc" } } }
    });

    for (const rule of rules) {
        const days = rule.triggerConfig?.days ?? 1;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        // Leads with no activity since cutoff
        const leads = await prisma.lead.findMany({
            where: {
                updatedAt: { lt: cutoff },
                status: { notIn: ["CONVERTED", "LOST"] }
            }
        });

        for (const lead of leads) {
            // Skip if already fired this rule for this lead recently
            const recentLog = await prisma.automationLog.findFirst({
                where: {
                    ruleId: rule.id,
                    leadId: lead.id,
                    status: "SUCCESS",
                    createdAt: { gt: cutoff }
                }
            });
            if (recentLog) continue;

            const conditionsMet = matchesAllConditions(lead, rule.conditions);
            if (!conditionsMet) continue;

            for (const action of rule.actions) {
                try { await executeAction(action, lead); } catch {}
            }

            await prisma.automationLog.create({
                data: { ruleId: rule.id, leadId: lead.id, status: "SUCCESS", details: { trigger: "NO_ACTIVITY", days } }
            });
        }
    }
}

module.exports = { runRulesForLead, runNoActivityRules };
