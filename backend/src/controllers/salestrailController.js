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
            page      = 1,
            limit     = 50,
            direction,
            status,
            search,
            from,   // date from  YYYY-MM-DD
            to,     // date to    YYYY-MM-DD
        } = req.query;

        const where = {};
        if (direction) where.direction = direction;
        if (status)    where.status    = status;
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
        const { days = 30 } = req.query;
        const since = new Date();
        since.setDate(since.getDate() - parseInt(days));

        const all = await prisma.salestrailCall.findMany({
            where:   { startedAt: { gte: since } },
            orderBy: { startedAt: "asc" },
            select:  { direction: true, status: true, duration: true, startedAt: true },
        });

        const totalCalls    = all.length;
        const answered      = all.filter((c) => c.status === "answered").length;
        const missed        = all.filter((c) => ["missed", "no_answer", "busy"].includes(c.status)).length;
        const outgoing      = all.filter((c) => c.direction === "outgoing").length;
        const incoming      = all.filter((c) => c.direction === "incoming").length;
        const totalDuration = all.reduce((s, c) => s + c.duration, 0);
        const avgDuration   = totalCalls ? Math.round(totalDuration / totalCalls) : 0;

        // Today's calls
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const today = all.filter((c) => c.startedAt && new Date(c.startedAt) >= todayStart).length;

        // Calls per day (last N days)
        const dayMap = {};
        for (let i = parseInt(days) - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split("T")[0];
            dayMap[key] = { date: key, total: 0, answered: 0, missed: 0, outgoing: 0, incoming: 0, duration: 0 };
        }
        for (const c of all) {
            if (!c.startedAt) continue;
            const key = new Date(c.startedAt).toISOString().split("T")[0];
            if (!dayMap[key]) continue;
            dayMap[key].total++;
            dayMap[key].duration += c.duration;
            if (c.status === "answered")                                           dayMap[key].answered++;
            if (["missed","no_answer","busy"].includes(c.status))                  dayMap[key].missed++;
            if (c.direction === "outgoing")                                        dayMap[key].outgoing++;
            if (c.direction === "incoming")                                        dayMap[key].incoming++;
        }

        res.json({
            summary: { totalCalls, answered, missed, outgoing, incoming, totalDuration, avgDuration, today },
            perDay:  Object.values(dayMap),
        });
    } catch (err) {
        res.status(500).json({ message: "Error fetching stats", error: err.message });
    }
};

module.exports = { salestrailWebhook, getCalls, getStats };
