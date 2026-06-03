const prisma = require("../utils/prisma");
const paginate = require("../utils/paginate");
const calculateLeadScore = require("../utils/leadScorer");
const logActivity = require("../utils/activityLogger");
const { createCommission } = require("../services/commissionService");
const leadService = require("../services/leadService");
const { getLeadsSchema } = require("../validations/lead.validation");
const normalizePhone = require("../utils/normalizePhone");
const { runRulesForLead } = require("../services/automationEngine");
const { getSuggestionsForLead, dismissSuggestion } = require("../services/followUpSuggestionService");
const { adjustLeadLoad, assignLeads: smartAssignLeads, batchAssignLeads, assignLeadOrAlert: autoAssignLead } = require("../services/leadDistributionEngine");
const XLSX = require("xlsx");
const { ApiError, ERROR_CODES } = require("../utils/apiError");
const { canAccessLead, canReassignLeadTo } = require("../services/permissionService");
const { getTeamMemberIds } = require("../services/organizationService");
const { csvField } = require("../utils/csv");

// Get Leads
const getLeads = async (req, res, next) => {
    try {
        const { userId, role } = req.user;

        // 1. Validate query params using Zod
        const validationResult = getLeadsSchema.safeParse(req.query);
        
        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                error: "Invalid query parameters",
                details: validationResult.error.errors
            });
        }

        const { page, limit, status, assignedTo, startDate, endDate, search, sortBy, sortOrder, isSearchLead, score_min, score_max, mine, source, category, enquiryType, sla } = validationResult.data;

        const rawFilters = {
            status,
            assignedTo,
            startDate,
            endDate,
            isSearchLead,
            score_min,
            score_max,
            mine,
            source,
            category,
            enquiryType,
            sla,
        };

        const filters = Object.fromEntries(
            Object.entries(rawFilters).filter(([_, value]) => value !== undefined)
        );

        // 2. Call Service
        const result = await leadService.getLeads({
            userId,
            role,
            page,
            limit,
            filters,
            search,
            sortBy,
            sortOrder
        });

        // 4. Send Response
        res.json(result);
    } catch (error) {

        return next(error);
    }
};

// Create Lead (Admin/Super Admin)
const createLead = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const { name, email, phone, source, enquiryType } = req.body;

        if (!name || !phone || !source || !enquiryType) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Name, phone, source, and enquiry type are required");
        }

        // Scoring
        const { score, category } = calculateLeadScore({ source, phone, email });

        const newLead = await prisma.lead.create({
            data: {
                name,
                email,
                phone,
                phoneNormalized: normalizePhone(phone),
                source,
                enquiryType,
                score,
                category
            }
        });

        // Log Activity
        await logActivity({
            leadId: newLead.id,
            userId,
            action: "LEAD_CREATED",
            metadata: { source, score, category }
        });

        // Fire automation rules + auto-assign async — don't block the response
        runRulesForLead("LEAD_CREATED", newLead).catch(console.error);
        autoAssignLead(newLead.id, { actorId: userId, reason: "AUTO_ASSIGNMENT" })
            .catch(err => console.error(`[AutoAssign] createLead ${newLead.id}:`, err.message || err));

        res.status(201).json({ message: "Lead created successfully", lead: newLead });
    } catch (error) {
        return next(error);
    }
};

// Update Lead Status (and other details)
const updateLead = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const { id } = req.params;
        const { status, name, email, phone, source, enquiryType, assignedToId, nextFollowUpAt } = req.body;

        const currentLead = await prisma.lead.findUnique({ where: { id } });
        if (!currentLead) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Lead not found");

        // RBAC: caller must be able to see this lead. Without this check any
        // authenticated user could PATCH /:id with arbitrary fields (IDOR).
        if (!(await canAccessLead(userId, role, currentLead))) {
            throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You do not have access to this lead");
        }

        // Only managers/admins may change the assignee.
        if (
            assignedToId !== undefined &&
            assignedToId !== currentLead.assignedToId &&
            !(await canReassignLeadTo(userId, role, assignedToId))
        ) {
            throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You cannot reassign this lead");
        }

        // Stage gate: CONVERTED requires at least phone or email
        if (status === "CONVERTED" && currentLead.status !== "CONVERTED") {
            const phone = req.body.phone ?? currentLead.phone;
            const email = req.body.email ?? currentLead.email;
            if (!phone && !email) {
                return res.status(422).json({
                    code: "STAGE_GATE",
                    message: "Cannot convert a lead without a phone number or email address.",
                });
            }
        }

        // Merge existing with updates for scoring
        const leadForScoring = { ...currentLead, ...req.body };
        const { score, category } = calculateLeadScore(leadForScoring);

        // Build clean update object, explicitly ignoring undefined to support partial PATCH
        // Auto-set nextFollowUpAt to 3 days out when transitioning to FOLLOW_UP and no date given
        let resolvedFollowUpAt = nextFollowUpAt !== undefined
            ? (nextFollowUpAt ? new Date(nextFollowUpAt) : null)
            : undefined;
        if (
            status === "FOLLOW_UP" &&
            currentLead.status !== "FOLLOW_UP" &&
            resolvedFollowUpAt === undefined &&
            !currentLead.nextFollowUpAt
        ) {
            resolvedFollowUpAt = new Date(Date.now() + 3 * 86_400_000);
        }

        const updateData = {
            ...(status !== undefined && { status }),
            ...(name !== undefined && { name }),
            ...(email !== undefined && { email }),
            ...(phone !== undefined && { phone, phoneNormalized: normalizePhone(phone) }),
            ...(source !== undefined && { source }),
            ...(enquiryType !== undefined && { enquiryType }),
            ...(assignedToId !== undefined && { assignedToId }),
            ...(resolvedFollowUpAt !== undefined && { nextFollowUpAt: resolvedFollowUpAt }),
            score,
            category
        };

        const updatedLead = await prisma.lead.update({
            where: { id },
            data: updateData
        });

        // Log Activity
        await logActivity({
            leadId: updatedLead.id,
            userId,
            action: "LEAD_UPDATED",
            metadata: {
                prevStatus: currentLead.status,
                newStatus: status,
                changes: req.body
            }
        });

        // Fire automation rules async — don't block the response
        if (status && status !== currentLead.status) {
            runRulesForLead("STATUS_CHANGED", updatedLead, { prevStatus: currentLead.status, newStatus: status }).catch(console.error);
        }
        // Only fire LEAD_ASSIGNED when the assignee actually changed
        const incomingAssignee = req.body.assignedToId;
        if (incomingAssignee && incomingAssignee !== currentLead.assignedToId) {
            runRulesForLead("LEAD_ASSIGNED", updatedLead).catch(console.error);
        }

        // Decrement load when lead leaves the active pool. "CLOSED" was a dead
        // string (not in the LeadStatus enum); MERGED was missing.
        const terminalStatuses = ["CONVERTED", "LOST", "MERGED"];
        const wasActive = !terminalStatuses.includes(currentLead.status);
        const isNowTerminal = terminalStatuses.includes(status);
        if (status && wasActive && isNowTerminal && updatedLead.assignedToId) {
            adjustLeadLoad(updatedLead.assignedToId, -1).catch(console.error);
        }

        // Trigger Commission if status changed to CONVERTED — idempotency guarded
        if (status === "CONVERTED" && currentLead.status !== "CONVERTED") {
            const targetUserId = updatedLead.assignedToId || userId;
            // Check-then-create inside a transaction to prevent duplicate commissions
            // on concurrent requests (e.g. double-click, retry). Schema-level unique
            // constraint on (userId, leadId) should also be added as a migration.
            await prisma.$transaction(async (tx) => {
                const existing = await tx.commission.findFirst({
                    where: { leadId: updatedLead.id, userId: targetUserId },
                    select: { id: true },
                });
                if (!existing) {
                    await createCommission(updatedLead.id, targetUserId);
                }
            }, { isolationLevel: "Serializable" });
        }

        res.json({ message: "Lead updated successfully", lead: updatedLead });
    } catch (error) {
        return next(error);
    }
};

// Assign Lead
const assignLead = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const { id } = req.params;
        const { assignedToId } = req.body;

        if (!assignedToId) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "assignedToId is required");
        }

        if (!(await canReassignLeadTo(userId, role, assignedToId))) {
            throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You cannot assign leads to this user");
        }

        const user = await prisma.user.findUnique({ where: { id: assignedToId } });
        if (!user) {
            throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Target user not found");
        }

        const updatedLead = await prisma.$transaction(async (tx) => {
            const lead = await tx.lead.update({
                where: { id },
                data: { assignedToId }
            });
            await tx.activity.create({
                data: {
                    leadId: lead.id,
                    userId,
                    action: "LEAD_ASSIGNED",
                    metadata: { assignedTo: user.name },
                }
            });
            return lead;
        });

        res.json({ message: "Lead assigned successfully", lead: updatedLead });
    } catch (error) {
        return next(error);
    }
};

// Check Duplicates
const checkDuplicate = async (req, res, next) => {
    try {
        const { email, phone } = req.body;

        const conditions = [];
        if (email) conditions.push({ email });
        if (phone) conditions.push({ phone });

        if (conditions.length === 0) {
            return res.json({ duplicate: false, existingLeads: [] });
        }

        const existingLeads = await prisma.lead.findMany({
            where: { OR: conditions }
        });

        if (existingLeads.length > 0) {
            return res.json({
                duplicate: true,
                existingLeads
            });
        }

        res.json({ duplicate: false, existingLeads: [] });
    } catch (error) {
        return next(error);
    }
};

// Merge Leads
const mergeLeads = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const { primaryLeadId, secondaryLeadId } = req.body;

        if (!primaryLeadId || !secondaryLeadId) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Both primary and secondary lead IDs are required");
        }

        // Use transaction to ensure data integrity
        const result = await prisma.$transaction(async (prisma) => {
            // Move Notes
            await prisma.note.updateMany({
                where: { leadId: secondaryLeadId },
                data: { leadId: primaryLeadId }
            });

            // Move Tasks
            await prisma.task.updateMany({
                where: { leadId: secondaryLeadId },
                data: { leadId: primaryLeadId }
            });

            // Move Activities
            await prisma.activity.updateMany({
                where: { leadId: secondaryLeadId },
                data: { leadId: primaryLeadId }
            });

            // Move communication history — these were previously orphaned on merge
            await prisma.whatsAppMessage.updateMany({
                where: { leadId: secondaryLeadId },
                data: { leadId: primaryLeadId }
            });

            await prisma.emailLog.updateMany({
                where: { leadId: secondaryLeadId },
                data: { leadId: primaryLeadId }
            });

            await prisma.callLog.updateMany({
                where: { leadId: secondaryLeadId },
                data: { leadId: primaryLeadId }
            });

            await prisma.salestrailCall.updateMany({
                where: { leadId: secondaryLeadId },
                data: { leadId: primaryLeadId }
            });

            // Stamp secondary as MERGED so it is excluded from conversion analytics
            // while remaining auditable. MERGED is a terminal status — not LOST.
            await prisma.lead.update({
                where: { id: secondaryLeadId },
                data: { status: "MERGED", assignedToId: null }
            });

            // Log Merge on Primary
            await logActivity({
                leadId: primaryLeadId,
                userId,
                action: "LEAD_MERGED",
                metadata: { mergedFrom: secondaryLeadId }
            });

            return await prisma.lead.findUnique({ where: { id: primaryLeadId } });
        });

        res.json({ message: "Leads merged successfully", lead: result });
    } catch (error) {
        return next(error);
    }
};

// Get Single Lead (detail page)
const getLead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { userId, role } = req.user;
        // Return core lead fields only — related data (activities, calls, notes, tasks,
        // reminders) is fetched via dedicated sub-resource endpoints to keep payload small.
        const lead = await prisma.lead.findUnique({
            where: { id },
            include: {
                assignedTo: {
                    select: { id: true, name: true, email: true, phone: true, profilePhoto: true }
                },
            },
        });
        if (!lead) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Lead not found");
        if (!(await canAccessLead(userId, role, lead))) {
            throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "Access denied");
        }
        res.json(lead);
    } catch (error) {
        return next(error);
    }
};

// Get Activities (paginated)
const getLeadActivities = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { userId, role } = req.user;
        if (role !== "SUPER_ADMIN") {
            const lead = await prisma.lead.findUnique({ where: { id }, select: { assignedToId: true } });
            if (!lead) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Lead not found");
            if (!(await canAccessLead(userId, role, lead))) {
                throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "Access denied");
            }
        }
        const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
        const where = { leadId: id };
        const [total, activities] = await prisma.$transaction([
            prisma.activity.count({ where }),
            prisma.activity.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
                include: { user: { select: { id: true, name: true } } },
            }),
        ]);
        res.json(paginate(activities, total, page, limit));
    } catch (error) {
        return next(error);
    }
};


// In-memory set of userIds with an active export — prevents concurrent exports per user.
// Single-process safe; for multi-process deployments a distributed lock (e.g. Redis) would be needed.
const activeExports = new Set();

// Export Leads to CSV
const exportLeads = async (req, res, next) => {
    try {
        const { userId, role } = req.user;

        if (activeExports.has(userId)) {
            throw new ApiError(429, ERROR_CODES.RATE_LIMITED, "An export is already in progress for your account. Please wait for it to finish.");
        }
        activeExports.add(userId);

        try {
            // Apply the same role-based scoping used in getLeads — prevents a non-admin
            // from exfiltrating the entire lead database via a single export request.
            // EMPLOYEE → own leads, MANAGER → team (+ unassigned), SUPER_ADMIN → all.
            const where = {};
            if (role === "EMPLOYEE") {
                where.assignedToId = userId;
            } else if (role === "MANAGER") {
                const teamIds = await getTeamMemberIds(userId);
                if (teamIds.length > 0) {
                    where.OR = [{ assignedToId: { in: teamIds } }, { assignedToId: null }];
                }
            }

            const headers = ["Name", "Email", "Phone", "Source", "Type", "Status", "Score", "Category", "Assigned To", "Created At"];

            res.header("Content-Type", "text/csv; charset=utf-8");
            res.attachment("leads.csv");
            res.write(headers.map(csvField).join(",") + "\r\n");

            const PAGE = 500;
            let cursor = undefined;
            let done = false;

            while (!done) {
                const page = await prisma.lead.findMany({
                    where,
                    include: { assignedTo: { select: { name: true } } },
                    orderBy: { createdAt: "desc" },
                    take: PAGE,
                    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
                });

                for (const lead of page) {
                    res.write([
                        lead.name,
                        lead.email || "",
                        lead.phone || "",
                        lead.source,
                        lead.enquiryType,
                        lead.status,
                        lead.score,
                        lead.category || "",
                        lead.assignedTo?.name || "Unassigned",
                        new Date(lead.createdAt).toLocaleDateString("en-IN"),
                    ].map(csvField).join(",") + "\r\n");
                }

                if (page.length < PAGE) {
                    done = true;
                } else {
                    cursor = page[page.length - 1].id;
                }
            }

            res.end();
        } finally {
            activeExports.delete(userId);
        }
    } catch (error) {

        return next(error);
    }
};

// Normalize a header string for flexible matching
const normalizeHeader = (h) => h.toLowerCase().replace(/[\s_\-\.#()]+/g, "").replace(/no$/, "").replace(/number$/, "").replace(/id$/, "");

const HEADER_ALIASES = {
    name:         ["name", "leadname", "fullname", "contactname", "customername", "firstname", "contact", "customer", "lead"],
    email:        ["email", "emailaddress", "emailid", "mail", "contactemail", "emailadd"],
    phone:        ["phone", "phonenumber", "mobile", "mobilenumber", "contact", "contactnumber", "cell", "cellphone", "telephone", "tel", "mob", "mobileno", "phoneno", "contactno", "whatsapp"],
    source:       ["source", "leadsource", "channel", "platform", "leadfrom", "from", "medium"],
    enquiryType:  ["type", "enquirytype", "enquiry", "category", "producttype", "servicetype", "leadtype", "interest"],
    assignedTo:   ["assignedto", "assignee", "employee", "agent", "salesrep", "owner", "assignedemployee", "rep", "salesperson"],
};

const matchHeader = (normalizedHeader, headerAliases) => {
    for (const [field, aliases] of Object.entries(headerAliases)) {
        if (aliases.includes(normalizedHeader)) return field;
    }
    for (const [field, aliases] of Object.entries(headerAliases)) {
        for (const alias of aliases) {
            if (normalizedHeader.includes(alias) || alias.includes(normalizedHeader)) return field;
        }
    }
    return null;
};

// Parse CSV or Excel buffer → array of row-objects keyed by mapped field name
function parseFileBuffer(buffer, originalname) {
    const isExcel = /\.(xlsx|xls)$/i.test(originalname);

    let rows; // string[][]
    if (isExcel) {
        const wb = XLSX.read(buffer, { type: "buffer" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    } else {
        // plain CSV parser
        const content = buffer.toString("utf-8");
        const parsed = [];
        let currentRow = [], currentField = "", inQuotes = false;
        for (let i = 0; i < content.length; i++) {
            const c = content[i], n = content[i + 1];
            if (c === '"' && inQuotes && n === '"') { currentField += '"'; i++; }
            else if (c === '"') { inQuotes = !inQuotes; }
            else if (c === "," && !inQuotes) { currentRow.push(currentField.trim()); currentField = ""; }
            else if ((c === "\r" || c === "\n") && !inQuotes) {
                if (currentField || currentRow.length > 0) { currentRow.push(currentField.trim()); parsed.push(currentRow); currentField = ""; currentRow = []; }
                if (c === "\r" && n === "\n") i++;
            } else { currentField += c; }
        }
        if (currentField || currentRow.length > 0) { currentRow.push(currentField.trim()); parsed.push(currentRow); }
        rows = parsed;
    }
    return rows;
}

// Build a fieldMap from raw header row: { colIndex → fieldName }
function buildFieldMap(headerRow) {
    const map = {};
    headerRow.forEach((h, idx) => {
        const norm = normalizeHeader(String(h ?? ""));
        const field = matchHeader(norm, HEADER_ALIASES);
        if (field) map[idx] = field;
    });
    return map;
}

// Preview — parse file, return metadata without touching the DB
const previewImport = async (req, res, next) => {
    try {
        if (!req.file) throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "No file uploaded");

        const rows = parseFileBuffer(req.file.buffer, req.file.originalname);
        if (rows.length < 2) throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "File is empty or has no data rows");

        const fieldMap = buildFieldMap(rows[0]);
        const hasAssignmentColumn = Object.values(fieldMap).includes("assignedTo");
        const columnHeaders = rows[0].map(String);

        const previewRows = rows.slice(1, 6).map(values => {
            const obj = {};
            Object.entries(fieldMap).forEach(([idx, field]) => { obj[field] = String(values[idx] ?? ""); });
            return obj;
        });

        res.json({
            totalRows: rows.length - 1,
            hasAssignmentColumn,
            columnHeaders,
            previewRows,
        });
    } catch (err) {
        return next(err);
    }
};

const VALID_SOURCES = ["FACEBOOK", "INSTAGRAM", "GMAIL", "WEBSITE", "PHONE_CALL"];
const VALID_ENQUIRY = ["PRODUCT", "WHITE_LABEL", "LMS", "SERVICES"];
const IMPORT_ERROR_CAP = 50; // max errors stored in ImportJob.errors JSON

// ── Background import worker ──────────────────────────────────────────────────
// Runs after the HTTP response is already sent. Updates the ImportJob record
// at each stage so the frontend can poll for progress.
async function runImportJob(jobId, { buffer, originalname, allocationMode, userId, role }) {
    // Helper: silently update job (never throws — a failed progress update
    // must not mask the real import error).
    const updateJob = (data) =>
        prisma.importJob.update({ where: { id: jobId }, data }).catch(() => {});

    try {
        // ── Stage: parsing ────────────────────────────────────────────────
        await updateJob({ status: "processing", stage: "parsing", progress: 10 });

        const rows = parseFileBuffer(buffer, originalname);
        const fieldMap = buildFieldMap(rows[0]);
        const counts = { imported: 0, skipped: 0, duplicates: 0, duplicatesFromRace: 0, failed: 0 };
        const errors = [];

        // Pass 1 — validate rows
        const parsedRows = [];
        for (let i = 1; i < rows.length; i++) {
            const values = rows[i];
            const row = {};
            Object.entries(fieldMap).forEach(([idx, field]) => { row[field] = String(values[idx] ?? "").trim(); });

            if (values.length < 2 || values.every(v => !String(v ?? "").trim())) { counts.skipped++; continue; }

            const name  = row.name  || "";
            const email = row.email || "";
            let   phone = (row.phone || "").replace(/^p:\s*/i, "").trim();
            let source      = (row.source      || "WEBSITE").toUpperCase().replace(/\s+/g, "_");
            let enquiryType = (row.enquiryType || "PRODUCT").toUpperCase().replace(/\s+/g, "_");
            if (!VALID_SOURCES.includes(source))       source      = "WEBSITE";
            if (!VALID_ENQUIRY.includes(enquiryType))  enquiryType = "PRODUCT";

            if (!name || !phone) {
                counts.failed++;
                if (errors.length < IMPORT_ERROR_CAP)
                    errors.push(`Row ${i + 1}: Missing required fields (name="${name}", phone="${phone}")`);
                continue;
            }
            parsedRows.push({ rowNum: i + 1, name, email, phone, source, enquiryType, assignedToRaw: row.assignedTo || "" });
        }

        // ── Stage: deduping ───────────────────────────────────────────────
        await updateJob({ stage: "deduping", progress: 25 });

        // Chunk the IN query to avoid oversized PostgreSQL parameters (>2000 at once)
        const allNormalized = parsedRows.map(r => normalizePhone(r.phone)).filter(Boolean);
        const existingPhones = new Set();
        const DEDUP_CHUNK = 2000;
        for (let i = 0; i < allNormalized.length; i += DEDUP_CHUNK) {
            const existing = await prisma.lead.findMany({
                where: { phoneNormalized: { in: allNormalized.slice(i, i + DEDUP_CHUNK) } },
                select: { phoneNormalized: true },
            });
            existing.forEach(l => existingPhones.add(l.phoneNormalized));
        }

        // Pass 3 — dedupe + score
        const seenInBatch = new Set();
        const newRows = [];
        for (const r of parsedRows) {
            const normalized = normalizePhone(r.phone);
            if (normalized && (existingPhones.has(normalized) || seenInBatch.has(normalized))) {
                counts.duplicates++;
                if (errors.length < IMPORT_ERROR_CAP)
                    errors.push(`Row ${r.rowNum}: Duplicate phone ${r.phone} — skipped`);
                continue;
            }
            const { score, category } = calculateLeadScore({ source: r.source, phone: r.phone, email: r.email });
            newRows.push({ ...r, normalized, score, category });
            if (normalized) seenInBatch.add(normalized);
        }

        if (newRows.length === 0) {
            await updateJob({
                status: "done", stage: "complete", progress: 100,
                imported: 0, duplicates: counts.duplicates, skipped: counts.skipped,
                failed: counts.failed, assigned: 0, errors,
                message: `Import complete: 0 imported, ${counts.duplicates} duplicate(s) skipped, ${counts.failed} failed`,
            });
            return;
        }

        // ── Stage: resolving "keep" employee map ──────────────────────────
        let employeeByName  = new Map();
        let employeeByEmail = new Map();
        if (allocationMode === "keep") {
            const rawNames = [...new Set(newRows.map(r => r.assignedToRaw).filter(Boolean))];
            if (rawNames.length > 0) {
                const employees = await prisma.user.findMany({
                    where: {
                        isActive: true,
                        OR: [
                            { name:  { in: rawNames, mode: "insensitive" } },
                            { email: { in: rawNames, mode: "insensitive" } },
                        ],
                    },
                    select: { id: true, name: true, email: true },
                });
                employees.forEach(e => {
                    employeeByName.set(e.name.toLowerCase(), e.id);
                    if (e.email) employeeByEmail.set(e.email.toLowerCase(), e.id);
                });
            }
        }

        // ── Stage: inserting ──────────────────────────────────────────────
        await updateJob({ stage: "inserting", progress: 40 });

        const INSERT_CHUNK = 500; // rows per createMany batch
        const insertedAt = new Date();
        let createdLeadIds = [];

        // Chunk inserts so a single giant createMany never risks a statement
        // timeout or exceeds Prisma's parameter limit on very large files.
        for (let i = 0; i < newRows.length; i += INSERT_CHUNK) {
            const chunk = newRows.slice(i, i + INSERT_CHUNK);

            await prisma.$transaction(async (tx) => {
                const { count } = await tx.lead.createMany({
                    data: chunk.map(r => {
                        let assignedToId = null;
                        if (allocationMode === "keep" && r.assignedToRaw) {
                            assignedToId =
                                employeeByName.get(r.assignedToRaw.toLowerCase()) ||
                                employeeByEmail.get(r.assignedToRaw.toLowerCase()) ||
                                null;
                        }
                        return {
                            name: r.name,
                            email: r.email || null,
                            phone: r.phone,
                            phoneNormalized: r.normalized,
                            source: r.source,
                            enquiryType: r.enquiryType,
                            score: r.score,
                            category: r.category,
                            ...(assignedToId ? { assignedToId, assignedAt: new Date() } : {}),
                        };
                    }),
                    skipDuplicates: true,
                });

                counts.imported += count;
                const raceSkipped = chunk.length - count;
                counts.duplicatesFromRace += raceSkipped;
                counts.duplicates += raceSkipped;

                if (count > 0) {
                    const created = await tx.lead.findMany({
                        where: {
                            phoneNormalized: { in: chunk.map(r => r.normalized).filter(Boolean) },
                            createdAt: { gte: insertedAt },
                        },
                        select: { id: true },
                    });
                    const ids = created.map(l => l.id);
                    createdLeadIds.push(...ids);

                    if (ids.length > 0) {
                        await tx.activity.createMany({
                            data: ids.map(id => ({
                                leadId: id,
                                userId,
                                action: "LEAD_CREATED",
                                metadata: { source: "FILE_IMPORT" },
                            })),
                        });
                    }
                }
            });

            // Update progress proportionally through the insert phase (40→70)
            const insertProgress = Math.round(40 + ((i + INSERT_CHUNK) / newRows.length) * 30);
            await updateJob({ stage: "inserting", progress: Math.min(70, insertProgress), imported: counts.imported });
        }

        // ── Stage: smart batch assignment ─────────────────────────────────
        let assignedCount = 0;
        if (allocationMode === "smart" && createdLeadIds.length > 0) {
            await updateJob({ stage: "assigning", progress: 75 });
            try {
                const assignOpts = role === "MANAGER"
                    ? { managerId: userId, actorId: userId }
                    : { actorId: userId };
                const result = await batchAssignLeads(createdLeadIds, assignOpts);
                assignedCount = result.assigned;
                if (result.failed > 0 && errors.length < IMPORT_ERROR_CAP) {
                    errors.push(`Smart allocation: ${result.failed} lead(s) could not be assigned (no available capacity)`);
                }
            } catch (err) {
                if (errors.length < IMPORT_ERROR_CAP)
                    errors.push(`Smart allocation warning: ${err.message}`);
            }
        }

        // ── Done ──────────────────────────────────────────────────────────
        const raceLine = counts.duplicatesFromRace > 0
            ? `, ${counts.duplicatesFromRace} caught by DB race guard` : "";
        await updateJob({
            status: "done", stage: "complete", progress: 100,
            imported: counts.imported, duplicates: counts.duplicates,
            skipped: counts.skipped, failed: counts.failed,
            assigned: assignedCount, errors,
            message: `Import complete: ${counts.imported} imported, ${counts.duplicates} duplicate(s) skipped${raceLine}, ${counts.failed} failed`,
        });
    } catch (err) {
        console.error(`ImportJob ${jobId} failed:`, err);
        await updateJob({ status: "failed", stage: "failed", message: err.message });
    }
}

// POST /leads/import
// Validates the file, creates an ImportJob record, responds immediately with
// the jobId, then spawns runImportJob in the background via setImmediate.
const importLeads = async (req, res, next) => {
    try {
        const { userId, role } = req.user;

        if (!req.file) throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "No file uploaded");

        const allocationMode = req.body?.allocationMode ?? "unassigned";

        // Hold buffer reference — multer may free req.file after the handler returns
        const buffer       = req.file.buffer;
        const originalname = req.file.originalname;

        // Quick structural check (header row only) before accepting the job
        const headerRows = parseFileBuffer(buffer, originalname);
        if (headerRows.length < 2) throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "File is empty or has no data rows");
        const estimatedTotal = headerRows.length - 1;

        const job = await prisma.importJob.create({
            data: { createdById: userId, total: estimatedTotal, status: "queued", stage: "queued" },
        });

        // Respond immediately — client will poll /import/status/:jobId
        res.json({ jobId: job.id, total: estimatedTotal, message: "Import queued — poll /leads/import/status/:jobId for progress" });

        // Full parse + all DB work happens after the HTTP response is flushed,
        // so the CPU-bound CSV/XLSX parsing doesn't add latency to the 200 response.
        setImmediate(() => runImportJob(job.id, { buffer, originalname, allocationMode, userId, role }));
    } catch (error) {

        return next(error);
    }
};

// GET /leads/import/status/:jobId
const getImportStatus = async (req, res, next) => {
    try {
        const job = await prisma.importJob.findUnique({ where: { id: req.params.jobId } });
        if (!job) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Import job not found");

        // Only the creator or an admin can see the job
        const { userId, role } = req.user;
        if (job.createdById !== userId && !["SUPER_ADMIN", "ADMIN"].includes(role)) {
            throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "Forbidden");
        }

        res.json(job);
    } catch (error) {
        return next(error);
    }
};

const getOverdueFollowUps = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const leadWhere = role === "EMPLOYEE" ? { assignedToId: userId } : {};
        const leads = await prisma.lead.findMany({
            where: {
                ...leadWhere,
                nextFollowUpAt: { lt: new Date() },
                status: { notIn: ["CONVERTED", "LOST", "MERGED"] },
            },
            select: {
                id: true, name: true, phone: true, email: true,
                status: true, nextFollowUpAt: true,
                assignedTo: { select: { id: true, name: true } },
            },
            orderBy: { nextFollowUpAt: "asc" },
            take: 15,
        });
        res.json(leads);
    } catch (error) {
        return next(error);
    }
};

const getDashboardStats = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const leadWhere = role === "EMPLOYEE" ? { assignedToId: userId } : {};
        const taskWhere = role === "EMPLOYEE" ? { assignedToId: userId, status: "PENDING" } : { status: "PENDING" };

        const now = new Date();
        const overdueWhere = {
            ...leadWhere,
            nextFollowUpAt: { lt: now },
            status: { notIn: ["CONVERTED", "LOST", "MERGED"] },
        };

        const [total, newLeadsToday, converted, followUp, pendingTasks, overdueFollowUps] = await prisma.$transaction([
            prisma.lead.count({ where: leadWhere }),
            prisma.lead.count({ where: { ...leadWhere, createdAt: { gte: today } } }),
            prisma.lead.count({ where: { ...leadWhere, status: "CONVERTED" } }),
            prisma.lead.count({ where: { ...leadWhere, status: "FOLLOW_UP" } }),
            prisma.task.count({ where: taskWhere }),
            prisma.lead.count({ where: overdueWhere }),
        ]);

        res.json({
            total,
            newLeadsToday,
            converted,
            followUp,
            pendingTasks,
            overdueFollowUps,
            conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0
        });
    } catch (error) {
        return next(error);
    }
};

// GET /leads/duplicates — find groups of leads sharing the same phone or email
const getDuplicates = async (req, res, next) => {
    try {
        // Ask the DB which phone/email values appear more than once — avoids full table scan in JS
        const [phoneDupeGroups, emailDupeGroups] = await Promise.all([
            prisma.lead.groupBy({
                by: ["phoneNormalized"],
                where: { phoneNormalized: { not: null } },
                _count: { phoneNormalized: true },
                having: { phoneNormalized: { _count: { gt: 1 } } },
            }),
            prisma.lead.groupBy({
                by: ["email"],
                where: { email: { not: null } },
                _count: { email: true },
                having: { email: { _count: { gt: 1 } } },
            }),
        ]);

        const dupePhones = phoneDupeGroups.map(r => r.phoneNormalized);
        const dupeEmails = emailDupeGroups.map(r => r.email);

        if (dupePhones.length === 0 && dupeEmails.length === 0) {
            return res.json({ groups: [], total: 0 });
        }

        // Fetch only the leads that actually have duplicates
        const leads = await prisma.lead.findMany({
            where: {
                OR: [
                    ...(dupePhones.length ? [{ phoneNormalized: { in: dupePhones } }] : []),
                    ...(dupeEmails.length ? [{ email: { in: dupeEmails } }] : []),
                ],
            },
            include: { assignedTo: { select: { id: true, name: true } } },
            orderBy: { createdAt: "asc" },
            take: 1000, // safety cap — UI can't usefully display more
        });

        const phoneMap = new Map();
        const emailMap = new Map();

        for (const lead of leads) {
            if (lead.phoneNormalized && dupePhones.includes(lead.phoneNormalized)) {
                if (!phoneMap.has(lead.phoneNormalized)) phoneMap.set(lead.phoneNormalized, []);
                phoneMap.get(lead.phoneNormalized).push(lead);
            }
            if (lead.email) {
                const key = lead.email.toLowerCase().trim();
                if (dupeEmails.some(e => e.toLowerCase() === key)) {
                    if (!emailMap.has(key)) emailMap.set(key, []);
                    emailMap.get(key).push(lead);
                }
            }
        }

        const groups = [];
        const seenIds = new Set();

        for (const [phone, groupLeads] of phoneMap) {
            groups.push({ type: "phone", value: phone, leads: groupLeads });
            groupLeads.forEach(l => seenIds.add(l.id));
        }

        for (const [email, groupLeads] of emailMap) {
            const hasNew = groupLeads.some(l => !seenIds.has(l.id));
            if (!hasNew) continue;
            groups.push({ type: "email", value: email, leads: groupLeads });
        }

        res.json({ groups, total: groups.length });
    } catch (error) {
        return next(error);
    }
};

// GET /leads/team-stats — per-member conversion stats (admin / team lead only)
const getTeamStats = async (req, res, next) => {
    try {
        const { role } = req.user;
        if (!["SUPER_ADMIN", "MANAGER"].includes(role)) {
            throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "Forbidden");
        }

        const [users, grouped] = await Promise.all([
            prisma.user.findMany({
                where: { isActive: true },
                select: { id: true, name: true, role: true },
            }),
            prisma.lead.groupBy({
                by: ["assignedToId", "status"],
                where: { assignedToId: { not: null } },
                _count: { id: true },
            }),
        ]);

        const statsMap = new Map();
        for (const row of grouped) {
            if (!row.assignedToId) continue;
            if (!statsMap.has(row.assignedToId)) {
                statsMap.set(row.assignedToId, { total: 0, converted: 0, followUp: 0, contacted: 0, lost: 0 });
            }
            const s = statsMap.get(row.assignedToId);
            s.total      += row._count.id;
            if (row.status === "CONVERTED")  s.converted  = row._count.id;
            if (row.status === "FOLLOW_UP")  s.followUp   = row._count.id;
            if (row.status === "CONTACTED")  s.contacted  = row._count.id;
            if (row.status === "LOST")       s.lost       = row._count.id;
        }

        const result = users
            .filter(u => statsMap.has(u.id))
            .map(u => {
                const s = statsMap.get(u.id);
                return {
                    userId: u.id,
                    name:   u.name,
                    role:   u.role,
                    ...s,
                    conversionRate: s.total > 0 ? Math.round((s.converted / s.total) * 100) : 0,
                };
            })
            .sort((a, b) => b.converted - a.converted || b.total - a.total);

        res.json(result);
    } catch (error) {
        return next(error);
    }
};

const getLeadSuggestions = async (req, res, next) => {
    try {
        const suggestions = await getSuggestionsForLead(req.params.id);
        res.json(suggestions);
    } catch (error) {

        return next(error);
    }
};

const dismissLeadSuggestion = async (req, res, next) => {
    try {
        const { key } = req.body;
        if (!key) throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "key is required");
        await dismissSuggestion(req.params.id, key, req.user.userId);
        res.json({ dismissed: true });
    } catch (error) {

        return next(error);
    }
};

// Reassign Lead with history tracking
const reassignLead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { employeeId, reason } = req.body;
        const { userId, role } = req.user;

        if (!employeeId) throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "employeeId is required");

        const { canReassignLeadTo } = require("../services/permissionService");
        const allowed = await canReassignLeadTo(userId, role, employeeId);
        if (!allowed) {
            throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You can only assign leads to members of your team");
        }

        const lead = await prisma.lead.findUnique({ where: { id } });
        if (!lead) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Lead not found");

        // MANAGER: current lead assignee must also be in same team
        if (role === "MANAGER" && lead.assignedToId) {
            const assignee = await prisma.user.findUnique({
                where: { id: lead.assignedToId },
                select: { managerId: true },
            });
            if (assignee?.managerId !== userId) {
                throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You can only reassign leads currently assigned to your team members");
            }
        }

        const employee = await prisma.user.findUnique({ where: { id: employeeId } });
        if (!employee) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Employee not found");

        const previousEmployeeId = lead.assignedToId || null;

        const [updatedLead] = await prisma.$transaction([
            prisma.lead.update({
                where: { id },
                data: { assignedToId: employeeId, assignedAt: new Date() },
                include: { assignedTo: { select: { id: true, name: true, email: true } } },
            }),
            prisma.assignmentHistory.create({
                data: { leadId: id, employeeId, previousEmployeeId, reason: reason || null },
            }),
            prisma.activity.create({
                data: {
                    leadId: id,
                    userId,
                    action: previousEmployeeId ? "LEAD_REASSIGNED" : "LEAD_ASSIGNED",
                    metadata: {
                        newEmployeeId: employeeId,
                        newEmployeeName: employee.name,
                        previousEmployeeId,
                        reason: reason || null,
                    },
                },
            }),
        ]);

        res.json({ message: "Lead reassigned successfully", lead: updatedLead });
    } catch (error) {
        return next(error);
    }
};

const getSLAAlerts = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const settings = await prisma.companySettings.findFirst();
        const breachDays = settings?.slaBreachDays ?? 7;
        const cutoff = new Date(Date.now() - breachDays * 86_400_000);

        const where = {
            status: { in: ["NEW", "CONTACTED", "FOLLOW_UP"] },
            OR: [
                { lastActivityAt: { lt: cutoff } },
                { lastActivityAt: null, updatedAt: { lt: cutoff } },
            ],
        };
        if (role === "EMPLOYEE") where.assignedToId = userId;

        const leads = await prisma.lead.findMany({
            where,
            orderBy: [{ lastActivityAt: "asc" }, { updatedAt: "asc" }],
            take: 20,
            select: {
                id: true, name: true, phone: true, email: true,
                status: true, lastActivityAt: true, updatedAt: true,
                assignedTo: { select: { id: true, name: true } },
            },
        });
        res.json({ data: leads, breachDays });
    } catch (err) {
        return next(err);
    }
};

module.exports = {
    getLeads,
    getLead,
    createLead,
    updateLead,
    assignLead,
    reassignLead,
    exportLeads,
    previewImport,
    importLeads,
    getImportStatus,
    checkDuplicate,
    mergeLeads,
    getLeadActivities,
    getDashboardStats,
    getOverdueFollowUps,
    getDuplicates,
    getTeamStats,
    getLeadSuggestions,
    dismissLeadSuggestion,
    getSLAAlerts,
};
