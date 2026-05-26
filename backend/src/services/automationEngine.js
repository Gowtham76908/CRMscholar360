const prisma = require("../utils/prisma");
const logActivity = require("../utils/activityLogger");
const { sendTemplateMessage } = require("./whatsappService");
const { sendEmail } = require("./emailService");
const normalizePhone = require("../utils/normalizePhone");

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
            // Fire chained STATUS_CHANGED rules — execution context propagates chain state
            runRulesForLead("STATUS_CHANGED", updatedLead, {
                ...childContext,
                prevStatus: lead.status,
                newStatus: cfg.status,
            }).catch(console.error);
            // Note: childContext already has triggerDepth+1 and this ruleId in ruleChain
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
            // Fire chained LEAD_ASSIGNED rules — execution context propagates chain state
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

        case "SEND_WHATSAPP": {
            if (!lead.phone) return { action: "SEND_WHATSAPP", skipped: true, reason: "no_phone" };
            const normalized = normalizePhone(lead.phone);
            if (!normalized) return { action: "SEND_WHATSAPP", skipped: true, reason: "invalid_phone" };
            try {
                const params = (cfg.parameters || []).map(p =>
                    p === "{{lead.name}}" ? lead.name : p
                );
                const result = await sendTemplateMessage(normalized, cfg.templateName, params);
                await prisma.whatsAppMessage.create({
                    data: {
                        leadId: lead.id,
                        userId: null,
                        phone: normalized,
                        direction: "OUTBOUND",
                        templateName: cfg.templateName,
                        messageBody: cfg.templateName,
                        status: result.status,
                        watiMessageId: result.watiMessageId,
                        providerPayload: result.raw,
                        sentAt: new Date(),
                    },
                });
                await logActivity({
                    leadId: lead.id,
                    userId: null,
                    action: "WHATSAPP_SENT",
                    metadata: { templateName: cfg.templateName, source: "automation" },
                });
            } catch (e) {
                console.warn(`[AutomationEngine] SEND_WHATSAPP failed for lead ${lead.id}: ${e.message}`);
                return { action: "SEND_WHATSAPP", skipped: true, reason: e.message };
            }
            return { action: "SEND_WHATSAPP", templateName: cfg.templateName };
        }

        case "SEND_EMAIL": {
            if (!lead.email) return { action: "SEND_EMAIL", skipped: true, reason: "no_email" };
            try {
                const body = (cfg.body || "Hi {{lead.name}}, thank you for your enquiry.").replace(/\{\{lead\.name\}\}/g, lead.name);
                await sendEmail({ to: lead.email, subject: cfg.subject || "Message from our team", text: body });
                await logActivity({
                    leadId: lead.id,
                    userId: null,
                    action: "EMAIL_SENT",
                    metadata: { subject: cfg.subject, source: "automation" },
                });
            } catch (e) {
                console.warn(`[AutomationEngine] SEND_EMAIL failed for lead ${lead.id}: ${e.message}`);
                return { action: "SEND_EMAIL", skipped: true, reason: e.message };
            }
            return { action: "SEND_EMAIL", subject: cfg.subject };
        }

        default:
            return { action: action.type, skipped: true };
    }
}

// ─── Constraint Checker ───────────────────────────────────────────────────────
// Constraints live in rule.triggerConfig.constraints as an array, e.g.:
//   [{ type: "COOLDOWN", hours: 24 }, { type: "MAX_EXECUTIONS_PER_DAY", max: 1 }]
//
// Returns { allowed: false, reason: string } if any constraint blocks the rule,
// or { allowed: true } if all pass.
// executionCtx carries { triggerDepth, ruleChain, chainId } for chain-aware constraints.

async function checkConstraints(rule, lead, executionCtx = {}) {
    const constraints = rule.triggerConfig?.constraints;
    if (!Array.isArray(constraints) || constraints.length === 0) return { allowed: true };

    for (const c of constraints) {
        switch (c.type) {

            case "COOLDOWN": {
                // Block if a SUCCESS log for this rule+lead exists within the last N hours
                const hours = c.hours ?? 24;
                const since = new Date(Date.now() - hours * 60 * 60 * 1000);
                const recent = await prisma.automationLog.findFirst({
                    where: { ruleId: rule.id, leadId: lead.id, status: "SUCCESS", createdAt: { gt: since } },
                    select: { id: true }
                });
                if (recent) return { allowed: false, reason: `COOLDOWN: fired within last ${hours}h` };
                break;
            }

            case "MAX_EXECUTIONS_PER_DAY": {
                const max = c.max ?? 1;
                const dayStart = new Date();
                dayStart.setHours(0, 0, 0, 0);
                const count = await prisma.automationLog.count({
                    where: { ruleId: rule.id, leadId: lead.id, status: "SUCCESS", createdAt: { gt: dayStart } }
                });
                if (count >= max) return { allowed: false, reason: `MAX_EXECUTIONS_PER_DAY: already ran ${count}/${max} today` };
                break;
            }

            case "BUSINESS_HOURS_ONLY": {
                // Default 9–18 local server time; customise with startHour/endHour
                const now = new Date();
                const hour = now.getHours();
                const start = c.startHour ?? 9;
                const end   = c.endHour   ?? 18;
                if (hour < start || hour >= end)
                    return { allowed: false, reason: `BUSINESS_HOURS_ONLY: current hour ${hour} outside ${start}–${end}` };
                break;
            }

            case "SKIP_WEEKENDS": {
                const day = new Date().getDay(); // 0 = Sunday, 6 = Saturday
                if (day === 0 || day === 6)
                    return { allowed: false, reason: `SKIP_WEEKENDS: today is ${day === 0 ? "Sunday" : "Saturday"}` };
                break;
            }

            case "PREVENT_DUPLICATES": {
                // Never fire this rule for this lead more than once ever
                const ever = await prisma.automationLog.findFirst({
                    where: { ruleId: rule.id, leadId: lead.id, status: "SUCCESS" },
                    select: { id: true }
                });
                if (ever) return { allowed: false, reason: "PREVENT_DUPLICATES: already fired once for this lead" };
                break;
            }

            case "PREVENT_RECURSIVE_TRIGGERS": {
                // Block if this exact rule already appears earlier in the current execution chain.
                // This stops: Rule A fires → mutates lead → triggers Rule A again → repeat.
                const chain = executionCtx.ruleChain ?? [];
                if (chain.includes(rule.id))
                    return { allowed: false, reason: `PREVENT_RECURSIVE_TRIGGERS: rule ${rule.id} already in chain [${chain.join(" → ")}]` };
                break;
            }

            default:
                // Unknown constraint type — log warning and allow
                console.warn(`[AutomationEngine] Unknown constraint type "${c.type}" on rule ${rule.id} — skipped`);
        }
    }
    return { allowed: true };
}

// ─── Execution Context ────────────────────────────────────────────────────────
// Every top-level call to runRulesForLead() creates a fresh ExecutionContext.
// Child calls (triggered by actions like CHANGE_STATUS) inherit the same chainId
// and carry an extended ruleChain so we can detect cycles.
//
// Fields:
//   chainId      — UUID for the whole chain (links all logs from one trigger event)
//   triggerDepth — 0 = user action, 1 = automation-triggered, etc.
//   ruleChain    — ordered list of ruleIds that ran so far in this chain
//
// Hard cap: triggerDepth > MAX_TRIGGER_DEPTH aborts regardless of constraints.
// This is a safety net for bugs; PREVENT_RECURSIVE_TRIGGERS is the semantic guard.

const MAX_TRIGGER_DEPTH = 3;

function makeRootContext(extra = {}) {
    return {
        chainId:      crypto.randomUUID(),
        triggerDepth: 0,
        ruleChain:    [],
        ...extra,
    };
}

function childContext(parent, ruleId) {
    return {
        ...parent,
        triggerDepth: parent.triggerDepth + 1,
        ruleChain:    [...parent.ruleChain, ruleId],
    };
}

// ─── Rule Runner ──────────────────────────────────────────────────────────────

async function runRulesForLead(triggerType, lead, context = null) {
    const ctx = context ?? makeRootContext();

    if (ctx.triggerDepth > MAX_TRIGGER_DEPTH) {
        console.warn(
            `[AutomationEngine] Hard depth limit hit: ${triggerType} on lead ${lead.id} ` +
            `chain=[${ctx.ruleChain.join(" → ")}] chainId=${ctx.chainId} — aborted`
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
            if (rule.triggerConfig.status !== ctx.newStatus) continue;
        }

        const conditionsMet = matchesAllConditions(lead, rule.conditions);
        if (!conditionsMet) continue;

        const constraintCheck = await checkConstraints(rule, lead, ctx);
        if (!constraintCheck.allowed) continue;

        const results = [];
        let failed = false;
        // Build child context — this rule is now part of the chain
        const child = childContext(ctx, rule.id);

        for (const action of rule.actions) {
            try {
                const result = await executeAction(action, lead, child);
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
                details: {
                    results,
                    chainId:      ctx.chainId,
                    triggerDepth: ctx.triggerDepth,
                    ruleChain:    ctx.ruleChain,
                }
            }
        });
    }
}

// ─── Time-based: No Activity trigger ─────────────────────────────────────────
// Called by a daily cron or scheduler
const NO_ACTIVITY_CHUNK = 100;

async function runNoActivityRules() {
    const rules = await prisma.automationRule.findMany({
        where: { triggerType: "NO_ACTIVITY", isActive: true },
        include: { conditions: true, actions: { orderBy: { order: "asc" } } }
    });

    for (const rule of rules) {
        const days = rule.triggerConfig?.days ?? 1;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        // Fetch qualifying leads in pages to avoid loading all leads into memory
        let cursor = undefined;
        while (true) {
            const leads = await prisma.lead.findMany({
                where: { updatedAt: { lt: cutoff }, status: { notIn: ["CONVERTED", "LOST"] } },
                take: NO_ACTIVITY_CHUNK,
                ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
                orderBy: { id: "asc" },
            });

            if (leads.length === 0) break;
            cursor = leads[leads.length - 1].id;

            // Bulk-fetch recent SUCCESS logs for this rule + this batch of leads in one query
            const leadIds = leads.map(l => l.id);
            const recentLogs = await prisma.automationLog.findMany({
                where: { ruleId: rule.id, leadId: { in: leadIds }, status: "SUCCESS", createdAt: { gt: cutoff } },
                select: { leadId: true },
            });
            const alreadyFired = new Set(recentLogs.map(l => l.leadId));

            const newLogData = [];

            for (const lead of leads) {
                if (alreadyFired.has(lead.id)) continue;

                const constraintCheck = await checkConstraints(rule, lead);
                if (!constraintCheck.allowed) continue;

                if (!matchesAllConditions(lead, rule.conditions)) continue;

                for (const action of rule.actions) {
                    try { await executeAction(action, lead); } catch {}
                }

                newLogData.push({ ruleId: rule.id, leadId: lead.id, status: "SUCCESS", details: { trigger: "NO_ACTIVITY", days } });
            }

            // Batch-write all success logs for this chunk in one query
            if (newLogData.length > 0) {
                await prisma.automationLog.createMany({ data: newLogData });
            }

            if (leads.length < NO_ACTIVITY_CHUNK) break;
        }
    }
}

module.exports = { runRulesForLead, runNoActivityRules };
