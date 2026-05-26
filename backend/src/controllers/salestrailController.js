const prisma = require("../utils/prisma");

// ── Auth helper ────────────────────────────────────────────────────────────
const verifyBasicAuth = (req) => {
    const header = req.headers["authorization"] || "";
    if (!header.startsWith("Basic ")) return false;
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const [user, pass] = decoded.split(":");
    return (
        user === process.env.SALESTRAIL_USER &&
        pass === process.env.SALESTRAIL_PASS
    );
};

// ── Field normaliser ───────────────────────────────────────────────────────
// Salestrail payload fields can vary — this handles all known variants
const parseCall = (raw) => {
    const d = raw.direction || raw.call_direction || "outgoing";
    const direction = d.toLowerCase().replace("bound", ""); // "outgoing","incoming","missed"

    const startedAt = raw.start_time || raw.started_at || raw.call_start || raw.created_at || null;
    const endedAt   = raw.end_time   || raw.ended_at   || raw.call_end   || null;

    // Agent (the Salestrail user who made/received the call)
    const agent = raw.user || {};
    const agentName  = agent.name  || raw.user_name  || raw.agent_name  || null;
    const agentEmail = agent.email || raw.user_email || raw.agent_email || null;

    // Contact (the customer)
    const contact = raw.contact || {};
    const contactName  = contact.name         || raw.contact_name  || raw.callee_name  || raw.caller_name  || null;
    const contactPhone = contact.phone_number || contact.phone     || raw.contact_phone || raw.phone_number || raw.to || raw.from || null;

    const fromNumber = raw.from || raw.caller_number || raw.from_number || null;
    const toNumber   = raw.to   || raw.callee_number || raw.to_number   || null;

    return {
        salestrailId: (raw.id || raw.call_id || raw.uuid || null)?.toString() || null,
        direction,
        status:       (raw.status || raw.state || raw.call_status || "answered").toLowerCase(),
        duration:     parseInt(raw.duration || 0),
        fromNumber,
        toNumber,
        agentName,
        agentEmail,
        contactName,
        contactPhone,
        recordingUrl: raw.recording_url || raw.recording || null,
        notes:        raw.notes || raw.description || null,
        startedAt:    startedAt ? new Date(startedAt) : null,
        endedAt:      endedAt   ? new Date(endedAt)   : null,
        rawPayload:   raw,
    };
};

// ── Match call to a CRM lead ───────────────────────────────────────────────
const matchLead = async (call) => {
    const phone = call.contactPhone || (call.direction === "outgoing" ? call.toNumber : call.fromNumber);
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, "").slice(-10);
    return prisma.lead.findFirst({ where: { phone: { endsWith: cleaned } } });
};

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/salestrail/webhook  — Salestrail pushes call data here
// ═══════════════════════════════════════════════════════════════════════════
const salestrailWebhook = async (req, res) => {
    try {
        if (!verifyBasicAuth(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const body    = req.body;
        const payloads = Array.isArray(body) ? body : [body];
        const results  = [];

        for (const raw of payloads) {
            const call = parseCall(raw);

            // Skip if salestrailId already stored
            if (call.salestrailId) {
                const exists = await prisma.salestrailCall.findUnique({
                    where: { salestrailId: call.salestrailId },
                });
                if (exists) {
                    results.push({ salestrailId: call.salestrailId, saved: false, reason: "duplicate" });
                    continue;
                }
            }

            const lead = await matchLead(call);

            const saved = await prisma.salestrailCall.create({
                data: { ...call, leadId: lead?.id || null },
            });

            // Log activity on lead if matched
            if (lead) {
                const mins = Math.floor(call.duration / 60);
                const secs = call.duration % 60;
                await prisma.activity.create({
                    data: {
                        leadId: lead.id,
                        action: `Salestrail ${call.direction} call — ${call.status} · ${mins}m ${secs}s${call.agentName ? ` by ${call.agentName}` : ""}`,
                    },
                });
            }

            results.push({ salestrailId: call.salestrailId, saved: saved.id, leadMatched: !!lead });
        }

        res.status(200).json({ received: payloads.length, results });
    } catch (err) {
        console.error("[SALESTRAIL WEBHOOK]", err.message);
        res.status(500).json({ message: "Webhook error", error: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/salestrail/calls  — list all call logs (paginated + filtered)
// ═══════════════════════════════════════════════════════════════════════════
const getCalls = async (req, res) => {
    try {
        const {
            page        = 1,
            limit       = 50,
            direction,
            status,
            search,
            from,         // date from  YYYY-MM-DD
            to,           // date to    YYYY-MM-DD
            agentEmails,  // comma-separated list to scope to specific agents
        } = req.query;

        const emailScope = agentEmails
            ? agentEmails.split(",").map(e => e.trim()).filter(Boolean)
            : null;

        const where = {};
        if (direction) where.direction = direction;
        if (status)    where.status    = status;
        if (emailScope?.length) where.agentEmail = { in: emailScope };
        if (from || to) {
            where.startedAt = {};
            if (from) where.startedAt.gte = new Date(from);
            if (to)   where.startedAt.lte = new Date(to + "T23:59:59Z");
        }
        if (search) {
            where.OR = [
                { contactName:  { contains: search, mode: "insensitive" } },
                { contactPhone: { contains: search } },
                { agentName:    { contains: search, mode: "insensitive" } },
                { agentEmail:   { contains: search, mode: "insensitive" } },
            ];
        }

        const [calls, total] = await Promise.all([
            prisma.salestrailCall.findMany({
                where,
                orderBy: { startedAt: "desc" },
                skip:  (parseInt(page) - 1) * parseInt(limit),
                take:  parseInt(limit),
                include: { lead: { select: { id: true, name: true, phone: true } } },
            }),
            prisma.salestrailCall.count({ where }),
        ]);

        res.json({ calls, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ message: "Error fetching calls", error: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/salestrail/stats  — summary + calls per day
// ═══════════════════════════════════════════════════════════════════════════
const getStats = async (req, res) => {
    try {
        const { days = 30, agentEmails } = req.query;
        const daysInt   = parseInt(days);
        const since     = new Date();
        since.setDate(since.getDate() - daysInt);
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

        const emailScope = agentEmails
            ? agentEmails.split(",").map(e => e.trim()).filter(Boolean)
            : null;

        // Build a parameterised email filter clause for raw SQL
        // Prisma doesn't support conditional fragments cleanly, so we branch here.
        let summaryRow, perDayRows;
        if (emailScope?.length) {
            [summaryRow, perDayRows] = await Promise.all([
                prisma.$queryRaw`
                    SELECT
                        COUNT(*)::int                                                              AS "totalCalls",
                        COUNT(*) FILTER (WHERE status = 'answered')::int                          AS answered,
                        COUNT(*) FILTER (WHERE status IN ('missed','no_answer','busy'))::int       AS missed,
                        COUNT(*) FILTER (WHERE direction = 'outgoing')::int                       AS outgoing,
                        COUNT(*) FILTER (WHERE direction = 'incoming')::int                       AS incoming,
                        COALESCE(SUM(duration),0)::int                                            AS "totalDuration",
                        COUNT(*) FILTER (WHERE "startedAt" >= ${todayStart})::int                 AS today
                    FROM "SalestrailCall"
                    WHERE "startedAt" >= ${since}
                      AND "agentEmail" = ANY(${emailScope})
                `,
                prisma.$queryRaw`
                    SELECT
                        DATE("startedAt")::text                                                    AS date,
                        COUNT(*)::int                                                              AS total,
                        COUNT(*) FILTER (WHERE status = 'answered')::int                          AS answered,
                        COUNT(*) FILTER (WHERE status IN ('missed','no_answer','busy'))::int       AS missed,
                        COUNT(*) FILTER (WHERE direction = 'outgoing')::int                       AS outgoing,
                        COUNT(*) FILTER (WHERE direction = 'incoming')::int                       AS incoming,
                        COALESCE(SUM(duration),0)::int                                            AS duration
                    FROM "SalestrailCall"
                    WHERE "startedAt" >= ${since}
                      AND "agentEmail" = ANY(${emailScope})
                    GROUP BY DATE("startedAt")
                    ORDER BY DATE("startedAt")
                `,
            ]);
        } else {
            [summaryRow, perDayRows] = await Promise.all([
                prisma.$queryRaw`
                    SELECT
                        COUNT(*)::int                                                              AS "totalCalls",
                        COUNT(*) FILTER (WHERE status = 'answered')::int                          AS answered,
                        COUNT(*) FILTER (WHERE status IN ('missed','no_answer','busy'))::int       AS missed,
                        COUNT(*) FILTER (WHERE direction = 'outgoing')::int                       AS outgoing,
                        COUNT(*) FILTER (WHERE direction = 'incoming')::int                       AS incoming,
                        COALESCE(SUM(duration),0)::int                                            AS "totalDuration",
                        COUNT(*) FILTER (WHERE "startedAt" >= ${todayStart})::int                 AS today
                    FROM "SalestrailCall"
                    WHERE "startedAt" >= ${since}
                `,
                prisma.$queryRaw`
                    SELECT
                        DATE("startedAt")::text                                                    AS date,
                        COUNT(*)::int                                                              AS total,
                        COUNT(*) FILTER (WHERE status = 'answered')::int                          AS answered,
                        COUNT(*) FILTER (WHERE status IN ('missed','no_answer','busy'))::int       AS missed,
                        COUNT(*) FILTER (WHERE direction = 'outgoing')::int                       AS outgoing,
                        COUNT(*) FILTER (WHERE direction = 'incoming')::int                       AS incoming,
                        COALESCE(SUM(duration),0)::int                                            AS duration
                    FROM "SalestrailCall"
                    WHERE "startedAt" >= ${since}
                    GROUP BY DATE("startedAt")
                    ORDER BY DATE("startedAt")
                `,
            ]);
        }

        const s = summaryRow[0] ?? {};
        const totalCalls    = Number(s.totalCalls    ?? 0);
        const totalDuration = Number(s.totalDuration ?? 0);
        const avgDuration   = totalCalls ? Math.round(totalDuration / totalCalls) : 0;

        // Build a full date spine so days with 0 calls still appear in the chart
        const dayIndex = new Map(perDayRows.map(r => [r.date, r]));
        const perDay = [];
        for (let i = daysInt - 1; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const key = d.toISOString().split("T")[0];
            const r = dayIndex.get(key);
            perDay.push({
                date:     key,
                total:    Number(r?.total    ?? 0),
                answered: Number(r?.answered ?? 0),
                missed:   Number(r?.missed   ?? 0),
                outgoing: Number(r?.outgoing ?? 0),
                incoming: Number(r?.incoming ?? 0),
                duration: Number(r?.duration ?? 0),
            });
        }

        res.json({
            summary: {
                totalCalls,
                answered:      Number(s.answered    ?? 0),
                missed:        Number(s.missed      ?? 0),
                outgoing:      Number(s.outgoing    ?? 0),
                incoming:      Number(s.incoming    ?? 0),
                totalDuration,
                avgDuration,
                today:         Number(s.today       ?? 0),
            },
            perDay,
        });
    } catch (err) {
        res.status(500).json({ message: "Error fetching stats", error: err.message });
    }
};

module.exports = { salestrailWebhook, getCalls, getStats };
