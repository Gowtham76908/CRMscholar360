const prisma = require("../utils/prisma");
const paginate = require("../utils/paginate");
const calculateLeadScore = require("../utils/leadScorer");
const logActivity = require("../utils/activityLogger");
const leadService = require("../services/leadService");
const { getLeadsSchema } = require("../validations/lead.validation");
const normalizePhone = require("../utils/normalizePhone");
const { runRulesForLead } = require("../services/automationEngine");
const { getSuggestionsForLead, dismissSuggestion } = require("../services/followUpSuggestionService");
const XLSX = require("xlsx");
const { ApiError, ERROR_CODES } = require("../utils/apiError");
const { canAccessLead } = require("../services/permissionService");
const { getUserDepartments } = require("../services/leadDepartmentService");
const { csvField } = require("../utils/csv");
const { getInitialStage } = require("../config/departmentWorkflows");
const { signUploadUrl } = require("../utils/signedUpload");

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

        const { page, limit, assignedTo, startDate, endDate, search, sortBy, sortOrder, isSearchLead, score_min, score_max, mine, source, category, enquiryType, sla, department, stage } = validationResult.data;

        const rawFilters = {
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
            department,
            stage,
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
        const { userId, role } = req.user;
        const { name, email, phone, source, enquiryType, customFields } = req.body;

        if (!name || !phone || !source || !enquiryType) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Name, phone, source, and enquiry type are required");
        }

        // Scoring
        const { score, category } = calculateLeadScore({ source, phone, email });

        // Centralized creation: atomically creates the Lead + its SALES LeadDepartment.
        // Force assign the creator to the SALES department.
        const newLead = await leadService.createLead(
            {
                name,
                email,
                phone,
                phoneNormalized: normalizePhone(phone),
                source,
                enquiryType,
                score,
                category,
                customFields
            },
            { 
                createdByUserId: userId,
                forceAssignToCreator: true // Always assign to the creator
            }
        );

        // Log Activity
        await logActivity({
            leadId: newLead.id,
            userId,
            action: "LEAD_CREATED",
            metadata: { source, score, category, assignedToCreator: true }
        });

        // Fire automation rules async — don't block the response.
        runRulesForLead("LEAD_CREATED", newLead).catch(console.error);

        res.status(201).json({ message: "Lead created successfully", lead: newLead });
    } catch (error) {
        return next(error);
    }
};

// Update Lead — customer details only. Workflow stage and consultant assignment
// are per-department now and live behind /lead-departments (updateStage /
// assignConsultant). This endpoint no longer touches status or assignedToId.
const updateLead = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const { id } = req.params;
        const { name, email, phone, source, enquiryType, nextFollowUpAt, customFields } = req.body;

        const currentLead = await prisma.lead.findUnique({ where: { id } });
        if (!currentLead) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Lead not found");

        // RBAC: caller must be able to see this lead. Without this check any
        // authenticated user could PATCH /:id with arbitrary fields (IDOR).
        if (!(await canAccessLead(userId, role, currentLead))) {
            throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You do not have access to this lead");
        }

        const resolvedFollowUpAt = nextFollowUpAt !== undefined
            ? (nextFollowUpAt ? new Date(nextFollowUpAt) : null)
            : undefined;

        const resolvedCustomFields = customFields !== undefined
            ? { ...(currentLead.customFields || {}), ...customFields }
            : undefined;

        const updateData = {
            ...(name !== undefined && { name }),
            ...(email !== undefined && { email }),
            ...(phone !== undefined && { phone, phoneNormalized: normalizePhone(phone) }),
            ...(source !== undefined && { source }),
            ...(enquiryType !== undefined && { enquiryType }),
            ...(resolvedFollowUpAt !== undefined && { nextFollowUpAt: resolvedFollowUpAt }),
            ...(resolvedCustomFields !== undefined && { customFields: resolvedCustomFields }),
        };

        const updatedLead = await prisma.lead.update({
            where: { id },
            data: updateData,
        });

        // NOTE: SALES stage progression is intentionally manual. Saving custom fields
        // (e.g. university_response, embassy_result) no longer auto-advances the stage —
        // users move the lead forward explicitly via the "Move to next stage" control.

        await logActivity({
            leadId: updatedLead.id,
            userId,
            action: "LEAD_UPDATED",
            metadata: { changes: req.body },
        });

        res.json({ message: "Lead updated successfully", lead: updatedLead });
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

            await prisma.fasterqCall.updateMany({
                where: { leadId: secondaryLeadId },
                data: { leadId: primaryLeadId }
            });

            // Stamp the secondary with mergedIntoId so it is excluded from all
            // normal views (filtered in leadService.getLeads) while remaining
            // auditable, and drop its department services so it leaves every queue.
            await prisma.leadDepartment.deleteMany({ where: { leadId: secondaryLeadId } });
            await prisma.lead.update({
                where: { id: secondaryLeadId },
                data: { mergedIntoId: primaryLeadId }
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
                leadDepartments: {
                    include: { assignedEmployee: { select: { id: true, name: true, email: true } } },
                },
            },
        });
        if (!lead) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Lead not found");
        if (!(await canAccessLead(userId, role, lead))) {
            throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "Access denied");
        }
        // Sign locally-stored resumes so the cross-origin <a> link can fetch them
        // without relying on third-party cookies (Cloudinary URLs pass through unchanged).
        if (lead.resumeUrl) lead.resumeUrl = signUploadUrl(lead.resumeUrl);
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
            const lead = await prisma.lead.findUnique({ where: { id }, select: { id: true } });
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
                include: { user: { select: { id: true, name: true, profilePhoto: true } } },
            }),
        ]);

        const userIds = new Set();
        activities.forEach(act => {
            const meta = act.metadata;
            if (meta && typeof meta === "object") {
                if (meta.consultantId) userIds.add(meta.consultantId);
                if (meta.toUserId) userIds.add(meta.toUserId);
                if (meta.fromUserId) userIds.add(meta.fromUserId);
                if (meta.assignedTo && typeof meta.assignedTo === "string" && meta.assignedTo.length === 36) {
                    userIds.add(meta.assignedTo);
                }
            }
        });

        const userMap = new Map();
        if (userIds.size > 0) {
            const users = await prisma.user.findMany({
                where: { id: { in: Array.from(userIds) } },
                select: { id: true, name: true },
            });
            users.forEach(u => userMap.set(u.id, u.name));
        }

        const enrichedActivities = activities.map(act => {
            let meta = act.metadata;
            if (meta && typeof meta === "object") {
                meta = { ...meta };
                if (meta.consultantId) meta.consultantName = userMap.get(meta.consultantId) || null;
                if (meta.toUserId) meta.toUserName = userMap.get(meta.toUserId) || null;
                if (meta.fromUserId) meta.fromUserName = userMap.get(meta.fromUserId) || null;
                if (meta.assignedTo && typeof meta.assignedTo === "string" && meta.assignedTo.length === 36) {
                    meta.assignedToName = userMap.get(meta.assignedTo) || null;
                }
                // Sign locally-stored resume links in RESUME_UPLOADED activities
                if (meta.resumeUrl) meta.resumeUrl = signUploadUrl(meta.resumeUrl);
            }
            return { ...act, metadata: meta };
        });

        res.json(paginate(enrichedActivities, total, page, limit));
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
            // Multi-department model: visible via LeadDepartment / UserDepartment.
            // EMPLOYEE → own assignments, ADMIN → their departments (+ own), SUPER_ADMIN → all.
            const where = {};
            if (role === "EMPLOYEE") {
                where.leadDepartments = { some: { assignedEmployeeId: userId } };
            } else if (role === "ADMIN") {
                const managed = await getUserDepartments(userId);
                where.leadDepartments = {
                    some: managed.length
                        ? { OR: [{ department: { in: managed } }, { assignedEmployeeId: userId }] }
                        : { assignedEmployeeId: userId },
                };
            }

            // Departments/stages live on LeadDepartment; summarised per row below.
            const headers = ["Name", "Email", "Phone", "Source", "Type", "Score", "Category", "Departments", "Created At"];

            res.header("Content-Type", "text/csv; charset=utf-8");
            res.attachment("leads.csv");
            res.write(headers.map(csvField).join(",") + "\r\n");

            const PAGE = 500;
            let cursor = undefined;
            let done = false;

            while (!done) {
                const page = await prisma.lead.findMany({
                    where,
                    include: { leadDepartments: { select: { department: true, stage: true } } },
                    orderBy: { createdAt: "desc" },
                    take: PAGE,
                    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
                });

                for (const lead of page) {
                    const services = (lead.leadDepartments || [])
                        .map(d => `${d.department}:${d.stage}`)
                        .join(" | ");
                    res.write([
                        lead.name,
                        lead.email || "",
                        lead.phone || "",
                        lead.source,
                        lead.enquiryType,
                        lead.score,
                        lead.category || "",
                        services,
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
    name:        ["name", "leadname", "fullname", "contactname", "customername", "firstname", "contact", "customer", "lead"],
    email:       ["email", "emailaddress", "emailid", "mail", "contactemail", "emailadd"],
    phone:       ["phone", "phonenumber", "mobile", "mobilenumber", "contact", "contactnumber", "cell", "cellphone", "telephone", "tel", "mob", "mobileno", "phoneno", "contactno", "whatsapp"],
    company:     ["company", "companyname", "organisation", "organization", "firm", "business", "employer"],
    source:      ["source", "leadsource", "channel", "platform", "leadfrom", "from", "medium"],
    enquiryType: ["type", "enquirytype", "enquiry", "producttype", "servicetype", "leadtype", "interest", "service"],
    biodata:     ["bio", "bionotes", "notes", "biodata", "description", "remarks", "comments", "about", "details", "summary"],
    jobTitle:    ["jobtitle", "title", "designation", "position", "role", "jobrole", "professionaltitle"],
    linkedinUrl: ["linkedin", "linkedinurl", "linkedinprofile", "linkedinlink", "profileurl"],
    assignedTo:  ["assignedto", "assignee", "employee", "agent", "salesrep", "owner", "assignedemployee", "rep", "salesperson"],
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
        const columnHeaders = rows[0].map(String);

        // Build per-column mapping metadata for the column-map UI
        const fieldUsage = {};
        Object.values(fieldMap).forEach(f => { fieldUsage[f] = (fieldUsage[f] || 0) + 1; });

        const columnMappings = columnHeaders.map((header, index) => {
            const norm  = normalizeHeader(String(header ?? ""));
            const field = fieldMap[index] ?? null;
            const aliases    = HEADER_ALIASES[field] || [];
            const confidence = !field ? "none" : aliases.includes(norm) ? "exact" : "fuzzy";
            const conflict   = field ? (fieldUsage[field] || 0) > 1 : false;
            return { index, header: String(header), field, confidence, conflict };
        });

        const hasConflicts        = columnMappings.some(m => m.conflict);
        const hasUnmapped         = columnMappings.some(m => !m.field);
        const hasAssignmentColumn = Object.values(fieldMap).includes("assignedTo");

        const availableCustomFields = await prisma.customFieldDef.findMany({
            where: { isSystem: false },
            select: { id: true, name: true, fieldKey: true },
            orderBy: { order: "asc" },
        });

        const previewRows = rows.slice(1, 6).map(values =>
            Object.fromEntries(columnHeaders.map((h, i) => [h, String(values[i] ?? "")]))
        );

        res.json({
            totalRows: rows.length - 1,
            hasAssignmentColumn,
            columnHeaders,
            previewRows,
            columnMappings,
            hasConflicts,
            hasUnmapped,
            availableCustomFields,
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
async function runImportJob(jobId, { buffer, originalname, allocationMode, userId, role, confirmedColumnMap }) {
    // Helper: silently update job (never throws — a failed progress update
    // must not mask the real import error).
    const updateJob = (data) =>
        prisma.importJob.update({ where: { id: jobId }, data }).catch(() => {});

    try {
        // ── Stage: parsing ────────────────────────────────────────────────
        await updateJob({ status: "processing", stage: "parsing", progress: 10 });

        const rows = parseFileBuffer(buffer, originalname);

        // Use user-confirmed column map if provided, otherwise auto-detect from header aliases
        let fieldMap;
        if (confirmedColumnMap && Array.isArray(confirmedColumnMap) && confirmedColumnMap.length > 0) {
            fieldMap = {};
            confirmedColumnMap.forEach(({ index, field }) => {
                if (field && field !== "new") fieldMap[index] = field;
            });
        } else {
            fieldMap = buildFieldMap(rows[0]);
        }

        const counts = { imported: 0, skipped: 0, duplicates: 0, duplicatesFromRace: 0, failed: 0 };
        const errors = [];

        // Pass 1 — validate rows
        const parsedRows = [];
        for (let i = 1; i < rows.length; i++) {
            const values = rows[i];
            const row = {};
            Object.entries(fieldMap).forEach(([idx, field]) => { row[field] = String(values[idx] ?? "").trim(); });

            if (values.length < 2 || values.every(v => !String(v ?? "").trim())) { counts.skipped++; continue; }

            const name        = row.name        || "";
            const email       = row.email       || "";
            const company     = row.company     || "";
            const biodata     = row.biodata     || "";
            const jobTitle    = row.jobTitle    || "";
            const linkedinUrl = row.linkedinUrl || "";
            let phone = (row.phone || "").replace(/^p:\s*/i, "").trim();
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
            // Collect values for custom fields (fieldMap keys prefixed with "cf:")
            const customFields = {};
            Object.entries(row).forEach(([key, val]) => {
                if (key.startsWith("cf:") && val) customFields[key.slice(3)] = val;
            });

            parsedRows.push({ rowNum: i + 1, name, email, phone, company, biodata, jobTitle, linkedinUrl, source, enquiryType, assignedToRaw: row.assignedTo || "", customFields });
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
        const salesInitialStage = getInitialStage("SALES");
        let createdLeadIds = [];

        // Chunk inserts so a single giant createMany never risks a statement
        // timeout or exceeds Prisma's parameter limit on very large files.
        for (let i = 0; i < newRows.length; i += INSERT_CHUNK) {
            const chunk = newRows.slice(i, i + INSERT_CHUNK);

            // In "keep" mode the named consultant carries over onto the SALES
            // service (not a global lead owner). Map normalized phone → consultantId.
            const consultantByNormalized = new Map();
            if (allocationMode === "keep") {
                for (const r of chunk) {
                    if (!r.normalized || !r.assignedToRaw) continue;
                    const cid =
                        employeeByName.get(r.assignedToRaw.toLowerCase()) ||
                        employeeByEmail.get(r.assignedToRaw.toLowerCase()) ||
                        null;
                    if (cid) consultantByNormalized.set(r.normalized, cid);
                }
            }

            await prisma.$transaction(async (tx) => {
                const countToInsert = chunk.length;
                const counterRows = await tx.$queryRaw`
                    INSERT INTO "InvoiceCounter" ("prefix", "currentValue")
                    VALUES ('LEAD', 10000)
                    ON CONFLICT ("prefix") DO UPDATE
                        SET "currentValue" = "InvoiceCounter"."currentValue" + ${countToInsert}
                    RETURNING "currentValue"
                `;
                const finalVal = counterRows[0].currentValue;
                const startVal = finalVal - countToInsert + 1;

                 const year = new Date().getFullYear().toString().slice(-2);
                 const { count } = await tx.lead.createMany({
                     data: chunk.map((r, idx) => {
                         const nextVal = startVal + idx;
                         const seq = String(nextVal - 10000).padStart(4, '0');
                         const leadId = `sch-${year}-${seq}`;
                        return {
                            name: r.name,
                            email: r.email || null,
                            phone: r.phone,
                            phoneNormalized: r.normalized,
                            company: r.company || null,
                            biodata: r.biodata || null,
                            jobTitle: r.jobTitle || null,
                            linkedinUrl: r.linkedinUrl || null,
                            source: r.source,
                            enquiryType: r.enquiryType,
                            score: r.score,
                            category: r.category,
                            leadId,
                            ...(r.customFields && Object.keys(r.customFields).length > 0 ? { customFields: r.customFields } : {}),
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
                        select: { id: true, phoneNormalized: true },
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

                        // Every imported lead enters through Sales — create its SALES
                        // LeadDepartment so it is never orphaned under the new model.
                        // In "keep" mode the consultant carries onto the SALES service;
                        // otherwise it stays unassigned for a manager to allocate.
                        await tx.leadDepartment.createMany({
                            data: created.map(l => {
                                const cid = consultantByNormalized.get(l.phoneNormalized) || null;
                                return {
                                    leadId: l.id,
                                    department: "SALES",
                                    stage: salesInitialStage,
                                    assignedEmployeeId: cid,
                                    assignedAt: cid ? insertedAt : null,
                                };
                            }),
                            skipDuplicates: true,
                        });
                    }
                }
            });

            // Update progress proportionally through the insert phase (40→70)
            const insertProgress = Math.round(40 + ((i + INSERT_CHUNK) / newRows.length) * 30);
            await updateJob({ stage: "inserting", progress: Math.min(70, insertProgress), imported: counts.imported });
        }

        // Auto lead-distribution is retired. "smart" mode now behaves like
        // "unassigned": leads land in the SALES queue for a manager to allocate.

        // ── Done ──────────────────────────────────────────────────────────
        const raceLine = counts.duplicatesFromRace > 0
            ? `, ${counts.duplicatesFromRace} caught by DB race guard` : "";
        await updateJob({
            status: "done", stage: "complete", progress: 100,
            imported: counts.imported, duplicates: counts.duplicates,
            skipped: counts.skipped, failed: counts.failed,
            assigned: 0, errors,
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

        // Parse user-confirmed column map sent as JSON string in the multipart body
        let confirmedColumnMap = null;
        if (req.body?.columnMap) {
            try { confirmedColumnMap = JSON.parse(req.body.columnMap); } catch { /* fall back to auto-detect */ }
        }

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
        setImmediate(() => runImportJob(job.id, { buffer, originalname, allocationMode, userId, role, confirmedColumnMap }));
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
        // Consultants see only leads where they hold a department service.
        const where = {
            mergedIntoId: null,
            nextFollowUpAt: { lt: new Date() },
        };
        if (role === "EMPLOYEE") {
            where.leadDepartments = { some: { assignedEmployeeId: userId } };
        }
        const leads = await prisma.lead.findMany({
            where,
            select: {
                id: true, name: true, phone: true, email: true, nextFollowUpAt: true,
                leadDepartments: {
                    select: { department: true, stage: true, assignedEmployee: { select: { id: true, name: true } } },
                },
            },
            orderBy: { nextFollowUpAt: "asc" },
            take: 15,
        });
        res.json(leads);
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

const getSLAAlerts = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const settings = await prisma.companySettings.findFirst();
        const breachDays = settings?.slaBreachDays ?? 7;
        const cutoff = new Date(Date.now() - breachDays * 86_400_000);

        // Active = the lead still has at least one non-terminal department service.
        // Idle is measured by lastActivityAt / updatedAt as before.
        const where = {
            mergedIntoId: null,
            leadDepartments: { some: {} },
            OR: [
                { lastActivityAt: { lt: cutoff } },
                { lastActivityAt: null, updatedAt: { lt: cutoff } },
            ],
        };
        if (role === "EMPLOYEE") {
            where.leadDepartments = { some: { assignedEmployeeId: userId } };
        }

        const leads = await prisma.lead.findMany({
            where,
            orderBy: [{ lastActivityAt: "asc" }, { updatedAt: "asc" }],
            take: 20,
            select: {
                id: true, name: true, phone: true, email: true,
                lastActivityAt: true, updatedAt: true,
                leadDepartments: {
                    select: { department: true, stage: true, assignedEmployee: { select: { id: true, name: true } } },
                },
            },
        });
        res.json({ data: leads, breachDays });
    } catch (err) {
        return next(err);
    }
};

const getStats = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const where = {
            mergedIntoId: null,
            nextFollowUpAt: { lt: new Date() },
        };
        if (role === "EMPLOYEE") {
            where.leadDepartments = { some: { assignedEmployeeId: userId } };
        }
        const followUp = await prisma.lead.count({ where });
        res.json({ followUp });
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    getLeads,
    getLead,
    createLead,
    updateLead,
    exportLeads,
    previewImport,
    importLeads,
    getImportStatus,
    checkDuplicate,
    mergeLeads,
    getLeadActivities,
    getOverdueFollowUps,
    getDuplicates,
    getLeadSuggestions,
    dismissLeadSuggestion,
    getSLAAlerts,
    getStats,
};
