const crypto = require("crypto");
const prisma = require("../utils/prisma");
const { sendTemplateMessage } = require("./whatsappService");
const { sendEmail } = require("./emailService");
const normalizePhone = require("../utils/normalizePhone");
const { nowIST } = require("../utils/istTime");
const { isValidStage } = require("../config/departmentWorkflows");

/**
 * Automation engine — department-stage based.
 *
 * The unit of work is a LeadDepartment (one department's service on a customer),
 * not the customer (Lead). There is no global Lead.status workflow any more, so the
 * source of truth for automation is "a LeadDepartment's stage changed".
 *
 * Generic trigger structure (so new department events can be added without a
 * redesign):
 *
 *   Department events  — runRulesForDepartmentEvent(triggerType, leadDept, ctx)
 *     STAGE_CHANGED          a service moved to a new workflow stage   (implemented)
 *     ASSIGNED               a consultant was assigned to a service    (implemented)
 *     UNASSIGNED             a service's consultant was removed        (wired, no seed yet)
 *     DEPARTMENT_ALLOCATED   a customer was allocated to a department  (implemented)
 *
 *   Lead-level events  — runRulesForLead(triggerType, lead, ctx)
 *     LEAD_CREATED           a new customer entered the CRM
 *     MISSED_CALL            an inbound call was missed
 *     NO_ACTIVITY            time-based, fired by the scheduler (runNoActivityRules)
 *
 * A department rule carries its department + stage in triggerConfig, e.g.
 *   { "department": "LOAN", "stage": "APPROVED" }
 * STAGE_CHANGED execution originates from leadDepartmentService.updateStage(),
 * the single place stage transitions happen (and from chained CHANGE_STAGE actions).
 */

// ─── Condition Evaluator ──────────────────────────────────────────────────────
// A "target" is { lead, leadDept }. leadDept is null for lead-level events.

function getField(field, target) {
    const lead = target.lead || {};
    const leadDept = target.leadDept || null;
    const map = {
        source:      lead.source,
        enquiryType: lead.enquiryType,
        department:  leadDept?.department,
        stage:       leadDept?.stage,
        // Assignment is per-department now; lead-level events have no assignee.
        assignedTo:  leadDept ? leadDept.assignedEmployeeId : null,
    };
    return map[field] ?? null;
}

function matchesCondition(target, cond) {
    const val = getField(cond.field, target);
    switch (cond.operator) {
        case "equals":        return val === cond.value;
        case "not_equals":    return val !== cond.value;
        case "is_empty":      return !val;
        case "is_not_empty":  return !!val;
        default:              return false;
    }
}

function matchesAllConditions(target, conditions) {
    return conditions.every(c => matchesCondition(target, c));
}

/** The user a task/reminder/notification should go to for this target. */
function assigneeOf(target) {
    return target.leadDept ? target.leadDept.assignedEmployeeId : null;
}

// ─── Action Executor ──────────────────────────────────────────────────────────
// Mutating actions return a fresh { lead, leadDept } so the runner can re-seed the
// target for subsequent actions. Chained department events are fired after commit.

async function executeAction(action, target, childContext, tx) {
    const cfg = action.config || {};
    const lead = target.lead;
    const leadDept = target.leadDept;
    const assignee = assigneeOf(target);

    switch (action.type) {
        case "CHANGE_STAGE": {
            if (!leadDept) return { action: "CHANGE_STAGE", skipped: true, reason: "no_department_context" };
            if (!isValidStage(leadDept.department, cfg.stage)) {
                return { action: "CHANGE_STAGE", skipped: true, reason: `invalid_stage:${cfg.stage}` };
            }
            if (cfg.stage === leadDept.stage) return { action: "CHANGE_STAGE", skipped: true, reason: "same_stage" };

            const updatedDept = await tx.leadDepartment.update({
                where: { id: leadDept.id },
                data: { stage: cfg.stage },
            });
            await tx.activity.create({
                data: {
                    leadId: lead.id,
                    userId: null,
                    action: "STAGE_UPDATED",
                    metadata: { department: leadDept.department, from: leadDept.stage, to: cfg.stage, source: "automation" },
                },
            });
            // Chain a STAGE_CHANGED event after the tx commits.
            setImmediate(() => runRulesForDepartmentEvent("STAGE_CHANGED", updatedDept, {
                ...childContext,
                prevStage: leadDept.stage,
                newStage: cfg.stage,
            }).catch(console.error));
            return { action: "CHANGE_STAGE", department: leadDept.department, stage: cfg.stage, _refetch: true };
        }

        case "ASSIGN_CONSULTANT": {
            if (!leadDept) return { action: "ASSIGN_CONSULTANT", skipped: true, reason: "no_department_context" };
            if (!cfg.userId) return { action: "ASSIGN_CONSULTANT", skipped: true, reason: "no_user" };

            const updatedDept = await tx.leadDepartment.update({
                where: { id: leadDept.id },
                data: { assignedEmployeeId: cfg.userId, assignedAt: new Date() },
            });
            await tx.activity.create({
                data: {
                    leadId: lead.id,
                    userId: cfg.userId,
                    action: "CONSULTANT_ASSIGNED",
                    metadata: { department: leadDept.department, consultantId: cfg.userId, source: "automation" },
                },
            });
            setImmediate(() => runRulesForDepartmentEvent("ASSIGNED", updatedDept, childContext).catch(console.error));
            return { action: "ASSIGN_CONSULTANT", department: leadDept.department, userId: cfg.userId, _refetch: true };
        }

        case "CREATE_TASK": {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + (cfg.dueDaysFromNow ?? 1));
            await tx.task.create({
                data: {
                    title: cfg.title,
                    description: cfg.description,
                    leadId: lead.id,
                    assignedToId: assignee ?? null,
                    dueDate,
                    status: "PENDING",
                },
            });
            await tx.activity.create({
                data: {
                    leadId: lead.id,
                    userId: null,
                    action: "TASK_CREATED",
                    metadata: { title: cfg.title, department: leadDept?.department ?? null, source: "automation" },
                },
            });
            return { action: "CREATE_TASK", title: cfg.title };
        }

        case "CREATE_REMINDER": {
            if (!assignee) return { action: "CREATE_REMINDER", skipped: true, reason: "no_assignee" };
            const remindAt = new Date();
            remindAt.setHours(remindAt.getHours() + (cfg.dueHoursFromNow ?? 24));
            await tx.reminder.create({
                data: {
                    leadId: lead.id,
                    userId: assignee,
                    message: cfg.message,
                    remindAt,
                },
            });
            return { action: "CREATE_REMINDER", message: cfg.message };
        }

        case "SEND_NOTIFICATION": {
            if (!assignee) return { action: "SEND_NOTIFICATION", skipped: true, reason: "no_assignee" };
            await tx.notification.create({
                data: {
                    userId: assignee,
                    title: cfg.title ?? "Automation Alert",
                    message: cfg.message ?? `Action required on lead: ${lead.name}`,
                    type: cfg.type ?? "AUTOMATION",
                    link: `/leads/${lead.id}`,
                },
            });
            return { action: "SEND_NOTIFICATION", userId: assignee };
        }

        case "SEND_WHATSAPP": {
            if (!lead.phone) return { action: "SEND_WHATSAPP", skipped: true, reason: "no_phone" };
            if (!lead.whatsappOptIn) return { action: "SEND_WHATSAPP", skipped: true, reason: "no_opt_in" };
            const normalized = normalizePhone(lead.phone);
            if (!normalized) return { action: "SEND_WHATSAPP", skipped: true, reason: "invalid_phone" };

            // Pending side-effect: HTTP call runs OUTSIDE the Prisma transaction
            // (after commit). We only record intent here to keep the tx short.
            const params = (cfg.parameters || []).map(p =>
                p === "{{lead.name}}" ? lead.name : p
            );
            return {
                action: "SEND_WHATSAPP",
                templateName: cfg.templateName,
                _sideEffect: {
                    kind: "whatsapp",
                    leadId: lead.id,
                    phone: normalized,
                    templateName: cfg.templateName,
                    params,
                },
            };
        }

        case "SEND_EMAIL": {
            if (!lead.email) return { action: "SEND_EMAIL", skipped: true, reason: "no_email" };
            const body = (cfg.body || "Hi {{lead.name}}, thank you for your enquiry.").replace(/\{\{lead\.name\}\}/g, lead.name);
            return {
                action: "SEND_EMAIL",
                subject: cfg.subject,
                _sideEffect: {
                    kind:    "email",
                    leadId:  lead.id,
                    to:      lead.email,
                    subject: cfg.subject || "Message from our team",
                    body,
                },
            };
        }

        default:
            return { action: action.type, skipped: true, reason: "unknown_action" };
    }
}

// ─── Constraint Checker ───────────────────────────────────────────────────────
// Constraints live in rule.triggerConfig.constraints as an array, e.g.:
//   [{ type: "COOLDOWN", hours: 24 }, { type: "MAX_EXECUTIONS_PER_DAY", max: 1 }]
//
// Constraint history is keyed by ruleId + leadId. Because a department rule only
// matches one department (triggerConfig.department) and a lead has at most one
// LeadDepartment per department, ruleId + leadId already scopes to that service.

async function checkConstraints(rule, lead, executionCtx = {}) {
    const constraints = rule.triggerConfig?.constraints;
    if (!Array.isArray(constraints) || constraints.length === 0) return { allowed: true };

    for (const c of constraints) {
        switch (c.type) {

            case "COOLDOWN": {
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
                const hour = nowIST().getUTCHours();
                const start = c.startHour ?? 9;
                const end   = c.endHour   ?? 18;
                if (hour < start || hour >= end)
                    return { allowed: false, reason: `BUSINESS_HOURS_ONLY: current hour ${hour} (IST) outside ${start}–${end}` };
                break;
            }

            case "SKIP_WEEKENDS": {
                const day = nowIST().getUTCDay(); // 0 = Sunday, 6 = Saturday (IST)
                if (day === 0 || day === 6)
                    return { allowed: false, reason: `SKIP_WEEKENDS: today is ${day === 0 ? "Sunday" : "Saturday"}` };
                break;
            }

            case "PREVENT_DUPLICATES": {
                const ever = await prisma.automationLog.findFirst({
                    where: { ruleId: rule.id, leadId: lead.id, status: "SUCCESS" },
                    select: { id: true }
                });
                if (ever) return { allowed: false, reason: "PREVENT_DUPLICATES: already fired once for this lead" };
                break;
            }

            case "PREVENT_RECURSIVE_TRIGGERS": {
                const chain = executionCtx.ruleChain ?? [];
                if (chain.includes(rule.id))
                    return { allowed: false, reason: `PREVENT_RECURSIVE_TRIGGERS: rule ${rule.id} already in chain [${chain.join(" → ")}]` };
                break;
            }

            default:
                console.warn(`[AutomationEngine] Unknown constraint type "${c.type}" on rule ${rule.id} — skipped`);
        }
    }
    return { allowed: true };
}

// ─── Execution Context ────────────────────────────────────────────────────────
// Every top-level run creates a fresh ExecutionContext. Chained calls (from
// CHANGE_STAGE / ASSIGN_CONSULTANT actions) inherit the chainId and extend the
// ruleChain so cycles can be detected.
//
//   chainId      — UUID linking all logs from one trigger event
//   triggerDepth — 0 = user action, 1 = automation-triggered, etc.
//   ruleChain    — ordered ruleIds that ran so far in this chain
//
// Hard cap: triggerDepth > MAX_TRIGGER_DEPTH aborts regardless of constraints.

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

// ─── Generic Rule Runner ──────────────────────────────────────────────────────
// Shared by every trigger type. `target` is { lead, leadDept }; `matchTrigger`
// is an optional per-rule gate (department/stage matching for dept events).
// `refetchTarget` re-reads lead (+ leadDept) after a mutating action.

async function runRules({ triggerType, target, context, matchTrigger, refetchTarget }) {
    const ctx = context ? { ...makeRootContext(), ...context } : makeRootContext();

    if (ctx.triggerDepth > MAX_TRIGGER_DEPTH) {
        console.warn(
            `[AutomationEngine] Hard depth limit hit: ${triggerType} on lead ${target.lead?.id} ` +
            `chain=[${ctx.ruleChain.join(" → ")}] chainId=${ctx.chainId} — aborted`
        );
        return;
    }

    const rules = await prisma.automationRule.findMany({
        where: { triggerType, isActive: true },
        include: { conditions: true, actions: { orderBy: { order: "asc" } } },
    });

    for (const rule of rules) {
        if (matchTrigger && !matchTrigger(rule, target, ctx)) continue;
        if (!matchesAllConditions(target, rule.conditions)) continue;

        const constraintCheck = await checkConstraints(rule, target.lead, ctx);
        if (!constraintCheck.allowed) continue;

        const results = [];
        let failed = false;
        let working = target;
        const child = childContext(ctx, rule.id);

        try {
            await prisma.$transaction(async (tx) => {
                for (const action of rule.actions) {
                    const result = await executeAction(action, working, child, tx);
                    results.push(result);
                    if (result?._refetch && refetchTarget) {
                        working = await refetchTarget(working, tx);
                    }
                }
                await tx.automationLog.create({
                    data: {
                        ruleId: rule.id,
                        leadId: working.lead.id,
                        status: "SUCCESS",
                        details: {
                            department: working.leadDept?.department ?? null,
                            stage:      working.leadDept?.stage ?? null,
                            results,
                            chainId:      ctx.chainId,
                            triggerDepth: ctx.triggerDepth,
                            ruleChain:    ctx.ruleChain,
                        },
                    },
                });
            });
        } catch (err) {
            failed = true;
            results.push({ error: err.message });
            await prisma.automationLog.create({
                data: {
                    ruleId: rule.id,
                    leadId: target.lead.id,
                    status: "FAILED",
                    details: {
                        department: target.leadDept?.department ?? null,
                        results,
                        chainId:      ctx.chainId,
                        triggerDepth: ctx.triggerDepth,
                        ruleChain:    ctx.ruleChain,
                    },
                },
            }).catch(console.error);
        }

        // Deferred side-effects (HTTP calls) run AFTER the tx commits so the DB
        // connection isn't held open for external sends.
        if (!failed) {
            for (const result of results) {
                if (result?._sideEffect) {
                    runSideEffect(result._sideEffect).catch(err =>
                        console.error(`[AutomationEngine] side-effect ${result._sideEffect.kind} failed:`, err.message)
                    );
                }
            }
        }
    }
}

// ─── Public entry points ──────────────────────────────────────────────────────

/**
 * Run automation for a department event (STAGE_CHANGED, ASSIGNED, UNASSIGNED,
 * DEPARTMENT_ALLOCATED). `leadDept` is a LeadDepartment row; the lead is fetched
 * for contact fields. Department rules match on triggerConfig.department and, for
 * STAGE_CHANGED, triggerConfig.stage (the new stage).
 */
async function runRulesForDepartmentEvent(triggerType, leadDept, context = null) {
    if (!leadDept) return;
    const lead = await prisma.lead.findUnique({ where: { id: leadDept.leadId } });
    if (!lead) return;

    const target = { lead, leadDept };

    const matchTrigger = (rule) => {
        const tc = rule.triggerConfig || {};
        if (tc.department && tc.department !== leadDept.department) return false;
        if (triggerType === "STAGE_CHANGED" && tc.stage && tc.stage !== leadDept.stage) return false;
        return true;
    };

    const refetchTarget = async (working, tx) => {
        const freshDept = await tx.leadDepartment.findUnique({ where: { id: working.leadDept.id } });
        const freshLead = await tx.lead.findUnique({ where: { id: working.lead.id } });
        return { lead: freshLead, leadDept: freshDept };
    };

    await runRules({ triggerType, target, context, matchTrigger, refetchTarget });
}

/**
 * Run automation for a lead-level event (LEAD_CREATED, MISSED_CALL). These have no
 * department context; conditions on department/stage will simply not match.
 */
async function runRulesForLead(triggerType, lead, context = null) {
    if (!lead) return;
    const target = { lead, leadDept: null };
    const refetchTarget = async (working, tx) => ({
        lead: await tx.lead.findUnique({ where: { id: working.lead.id } }),
        leadDept: null,
    });
    await runRules({ triggerType, target, context, matchTrigger: null, refetchTarget });
}

/**
 * Execute a side-effect (external HTTP call) AFTER the rule transaction commits.
 * Writes its own DB record + activity log; failures are logged, not rolled back.
 */
async function runSideEffect(side) {
    if (side.kind === "whatsapp") {
        const result = await sendTemplateMessage(side.phone, side.templateName, side.params);
        await prisma.whatsAppMessage.create({
            data: {
                leadId:          side.leadId,
                userId:          null,
                phone:           side.phone,
                direction:       "OUTBOUND",
                templateName:    side.templateName,
                messageBody:     side.templateName,
                status:          result.status,
                watiMessageId:   result.watiMessageId,
                providerPayload: result.raw,
                sentAt:          new Date(),
            },
        });
        await prisma.activity.create({
            data: {
                leadId: side.leadId,
                userId: null,
                action: result.status === "SENT" ? "WHATSAPP_SENT" : "WHATSAPP_FAILED",
                metadata: { templateName: side.templateName, source: "automation", status: result.status },
            },
        });
        return;
    }
    if (side.kind === "email") {
        try {
            await sendEmail({ to: side.to, subject: side.subject, text: side.body });
            await prisma.activity.create({
                data: {
                    leadId: side.leadId,
                    userId: null,
                    action: "EMAIL_SENT",
                    metadata: { subject: side.subject, source: "automation" },
                },
            });
        } catch (err) {
            await prisma.activity.create({
                data: {
                    leadId: side.leadId,
                    userId: null,
                    action: "EMAIL_FAILED",
                    metadata: { subject: side.subject, source: "automation", error: err.message },
                },
            });
        }
        return;
    }
}

// ─── Time-based: No Activity trigger ─────────────────────────────────────────
// Lead-level, fired by a daily cron. A LeadDepartment-aware "stale service" sweep
// can be added later as a department event; this keeps the existing nudge working.
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

        let cursor = undefined;
        while (true) {
            const leads = await prisma.lead.findMany({
                where: { updatedAt: { lt: cutoff } },
                take: NO_ACTIVITY_CHUNK,
                ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
                orderBy: { id: "asc" },
            });

            if (leads.length === 0) break;
            cursor = leads[leads.length - 1].id;

            const leadIds = leads.map(l => l.id);
            const recentLogs = await prisma.automationLog.findMany({
                where: { ruleId: rule.id, leadId: { in: leadIds }, status: "SUCCESS", createdAt: { gt: cutoff } },
                select: { leadId: true },
            });
            const alreadyFired = new Set(recentLogs.map(l => l.leadId));

            for (const lead of leads) {
                if (alreadyFired.has(lead.id)) continue;

                const target = { lead, leadDept: null };
                const constraintCheck = await checkConstraints(rule, lead);
                if (!constraintCheck.allowed) continue;
                if (!matchesAllConditions(target, rule.conditions)) continue;

                const results = [];
                const ruleCtx = childContext(makeRootContext(), rule.id);
                let execFailed = false;

                try {
                    await prisma.$transaction(async (tx) => {
                        let working = target;
                        for (const action of rule.actions) {
                            const result = await executeAction(action, working, ruleCtx, tx);
                            results.push(result);
                            if (result?._refetch) {
                                working = { lead: await tx.lead.findUnique({ where: { id: working.lead.id } }), leadDept: null };
                            }
                        }
                        await tx.automationLog.create({
                            data: { ruleId: rule.id, leadId: lead.id, status: "SUCCESS", details: { trigger: "NO_ACTIVITY", days, results } },
                        });
                    });
                } catch (err) {
                    execFailed = true;
                    await prisma.automationLog.create({
                        data: { ruleId: rule.id, leadId: lead.id, status: "FAILED", details: { trigger: "NO_ACTIVITY", days, error: err.message } },
                    }).catch(console.error);
                }

                if (!execFailed) {
                    for (const result of results) {
                        if (result?._sideEffect) {
                            runSideEffect(result._sideEffect).catch(err =>
                                console.error(`[AutomationEngine] NO_ACTIVITY side-effect failed:`, err.message)
                            );
                        }
                    }
                }
            }

            if (leads.length < NO_ACTIVITY_CHUNK) break;
        }
    }
}

module.exports = { runRulesForDepartmentEvent, runRulesForLead, runNoActivityRules };
