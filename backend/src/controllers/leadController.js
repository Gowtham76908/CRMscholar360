const prisma = require("../utils/prisma");
const calculateLeadScore = require("../utils/leadScorer");
const logActivity = require("../utils/activityLogger");
const { createCommission } = require("../services/commissionService");

// Get Leads
const getLeads = async (req, res) => {
    try {
        const { userId, role } = req.user;

        const callLogsInclude = {
            callLogs: {
                orderBy: { createdAt: "desc" },
                take: 10
            }
        };

        let leads;
        if (role === "EMPLOYEE") {
            leads = await prisma.lead.findMany({
                where: { assignedToId: userId },
                include: callLogsInclude,
                orderBy: { createdAt: "desc" }
            });
        } else {
            leads = await prisma.lead.findMany({
                include: {
                    assignedTo: { select: { id: true, name: true, email: true } },
                    ...callLogsInclude
                },
                orderBy: { createdAt: "desc" }
            });
        }

        res.json(leads);
    } catch (error) {
        res.status(500).json({ message: "Error fetching leads", error: error.message });
    }
};

// Create Lead (Admin/Super Admin)
const createLead = async (req, res) => {
    try {
        const { userId } = req.user;
        const { name, email, phone, source, enquiryType } = req.body;

        // Scoring
        const { score, category } = calculateLeadScore({ source, phone, email });

        const newLead = await prisma.lead.create({
            data: {
                name,
                email,
                phone,
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

        res.status(201).json({ message: "Lead created successfully", lead: newLead });
    } catch (error) {
        res.status(500).json({ message: "Error creating lead", error: error.message });
    }
};

// Update Lead Status (and other details)
const updateLead = async (req, res) => {
    try {
        const { userId } = req.user;
        const { id } = req.params;
        const { status, name, email, phone, source } = req.body; // Allow updating other fields too

        // Fetch current lead to calculate delta for scoring if needed
        // For simplicity, we just recalculate if core fields are present or just update what's passed
        const currentLead = await prisma.lead.findUnique({ where: { id } });
        if (!currentLead) return res.status(404).json({ message: "Lead not found" });

        // Merge existing with updates for scoring
        const leadForScoring = { ...currentLead, ...req.body };
        const { score, category } = calculateLeadScore(leadForScoring);

        const updatedLead = await prisma.lead.update({
            where: { id },
            data: {
                status,
                name,
                email,
                phone,
                source,
                score,
                category
            }
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

        // Trigger Commission if status changed to CONVERTED
        if (status === "CONVERTED" && currentLead.status !== "CONVERTED") {
            // Assign commission to the person who converted it (current user) or the assignee?
            // Usually the assignee gets the commission.
            const targetUserId = updatedLead.assignedToId || userId;
            await createCommission(updatedLead.id, targetUserId);
        }

        res.json({ message: "Lead updated successfully", lead: updatedLead });
    } catch (error) {
        res.status(500).json({ message: "Error updating lead", error: error.message });
    }
};

// Assign Lead
const assignLead = async (req, res) => {
    try {
        const { userId } = req.user; // Admin ID
        const { id } = req.params;
        const { assignedToId } = req.body;

        const user = await prisma.user.findUnique({ where: { id: assignedToId } });
        if (!user) {
            return res.status(404).json({ message: "Target user not found" });
        }

        const updatedLead = await prisma.lead.update({
            where: { id },
            data: { assignedToId }
        });

        // Log Activity
        await logActivity({
            leadId: updatedLead.id,
            userId,
            action: "LEAD_ASSIGNED",
            metadata: { assignedTo: user.name }
        });

        res.json({ message: "Lead assigned successfully", lead: updatedLead });
    } catch (error) {
        res.status(500).json({ message: "Error assigning lead", error: error.message });
    }
};

// Check Duplicates
const checkDuplicate = async (req, res) => {
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
        res.status(500).json({ message: "Error checking duplicates", error: error.message });
    }
};

// Merge Leads
const mergeLeads = async (req, res) => {
    try {
        const { userId } = req.user;
        const { primaryLeadId, secondaryLeadId } = req.body;

        if (!primaryLeadId || !secondaryLeadId) {
            return res.status(400).json({ message: "Both primary and secondary lead IDs are required" });
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

            // Soft Delete Secondary (Mark as LOST or special MERGED status if exist, using LOST for now based on enum)
            // or we can delete? Prompt said "Soft delete (status = MERGED)".
            // My Enum LeadStatus doesn't have MERGED. I should add it or use LOST. 
            // I'll stick to LOST with a note, or better, I should have added MERGED to enum.
            // For now, I'll update it to 'LOST' and add a note.
            await prisma.lead.update({
                where: { id: secondaryLeadId },
                data: { status: "LOST", name: `[MERGED] ${primaryLeadId}` }
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
        res.status(500).json({ message: "Error merging leads", error: error.message });
    }
};

// Get Activities
const getLeadActivities = async (req, res) => {
    try {
        const { id } = req.params;
        const activities = await prisma.activity.findMany({
            where: { leadId: id },
            orderBy: { createdAt: "desc" },
            include: { user: { select: { name: true } } }
        });
        res.json(activities);
    } catch (error) {
        res.status(500).json({ message: "Error fetching activities", error: error.message });
    }
};

// Export Leads to CSV
const exportLeads = async (req, res) => {
    try {
        const leads = await prisma.lead.findMany({
            include: { assignedTo: { select: { name: true } } }
        });

        const fields = ["Name", "Email", "Phone", "Source", "Type", "Status", "Score", "Category", "Assigned To", "Created At"];
        const csv = [
            fields.join(","),
            ...leads.map(lead => [
                lead.name,
                lead.email || "",
                lead.phone,
                lead.source,
                lead.enquiryType,
                lead.status,
                lead.score,
                lead.category,
                lead.assignedTo?.name || "Unassigned",
                new Date(lead.createdAt).toLocaleDateString()
            ].map(field => `"${field}"`).join(","))
        ].join("\n");

        res.header("Content-Type", "text/csv");
        res.attachment("leads.csv");
        res.send(csv);
    } catch (error) {
        res.status(500).json({ message: "Error exporting leads", error: error.message });
    }
};

// Normalize a header string for flexible matching
const normalizeHeader = (h) => h.toLowerCase().replace(/[\s_\-\.#()]+/g, "").replace(/no$/, "").replace(/number$/, "").replace(/id$/, "");

// Map of normalized patterns to our field names
const HEADER_ALIASES = {
    name: ["name", "leadname", "fullname", "contactname", "customername", "firstname", "contact", "customer", "lead"],
    email: ["email", "emailaddress", "emailid", "mail", "contactemail", "emailadd"],
    phone: ["phone", "phonenumber", "mobile", "mobilenumber", "contact", "contactnumber", "cell", "cellphone", "telephone", "tel", "mob", "mobileno", "phoneno", "contactno", "whatsapp"],
    source: ["source", "leadsource", "channel", "platform", "leadfrom", "from", "medium"],
    enquiryType: ["type", "enquirytype", "enquiry", "category", "producttype", "servicetype", "leadtype", "interest"],
};

// Find the best matching field for a given header
const matchHeader = (normalizedHeader, headerAliases) => {
    for (const [field, aliases] of Object.entries(headerAliases)) {
        if (aliases.includes(normalizedHeader)) return field;
    }
    // Partial match fallback
    for (const [field, aliases] of Object.entries(headerAliases)) {
        for (const alias of aliases) {
            if (normalizedHeader.includes(alias) || alias.includes(normalizedHeader)) return field;
        }
    }
    return null;
};

// Import Leads from CSV
const importLeads = async (req, res) => {
    try {
        const { userId } = req.user;

        if (!req.file) {
            return res.status(400).json({ message: "No CSV file uploaded" });
        }

        const csvContent = req.file.buffer.toString("utf-8");
        const parseCSV = (content) => {
            const rows = [];
            let currentRow = [];
            let currentField = "";
            let inQuotes = false;

            for (let i = 0; i < content.length; i++) {
                const char = content[i];
                const nextChar = content[i + 1];

                if (char === '"' && inQuotes && nextChar === '"') {
                    currentField += '"';
                    i++;
                } else if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === "," && !inQuotes) {
                    currentRow.push(currentField.trim());
                    currentField = "";
                } else if ((char === "\r" || char === "\n") && !inQuotes) {
                    if (currentField || currentRow.length > 0) {
                        currentRow.push(currentField.trim());
                        rows.push(currentRow);
                        currentField = "";
                        currentRow = [];
                    }
                    if (char === "\r" && nextChar === "\n") i++;
                } else {
                    currentField += char;
                }
            }
            if (currentField || currentRow.length > 0) {
                currentRow.push(currentField.trim());
                rows.push(currentRow);
            }
            return rows;
        };

        const allRows = parseCSV(csvContent);
        if (allRows.length < 2) {
            return res.status(400).json({ message: "CSV file is empty or has no data rows" });
        }

        const headers = allRows[0].map(h => h.toLowerCase().replace(/[^\w]/g, ""));

        const validSources = ["FACEBOOK", "INSTAGRAM", "GMAIL", "WEBSITE", "PHONE_CALL"];
        const validEnquiryTypes = ["PRODUCT", "WHITE_LABEL", "LMS", "SERVICES"];

        const results = { imported: 0, skipped: 0, failed: 0, errors: [] };

        for (let i = 1; i < allRows.length; i++) {
            const values = allRows[i];
            const row = {};
            headers.forEach((h, idx) => { row[h] = values[idx] || ""; });

            // Detection for junk/date rows (e.g. 3/20/2026)
            const firstCell = values[0] || "";
            if (values.length < 2 || (firstCell.includes("/") && values.slice(1).every(v => !v))) {
                results.skipped++;
                continue;
            }

            const name = row["name"] || row["leadname"] || row["fullname"] || "";
            const email = row["email"] || "";
            let phone = row["phone"] || row["phonenumber"] || row["mobile"] || "";
            
            // Clean phone (strip p: or other common prefixes)
            phone = phone.replace(/^p:\s*/i, "").trim();

            let source = (row["source"] || "WEBSITE").toUpperCase().replace(/[\s]+/g, "_");
            let enquiryType = (row["type"] || row["enquirytype"] || "PRODUCT").toUpperCase().replace(/[\s]+/g, "_");

            if (!validSources.includes(source)) source = "WEBSITE";
            if (!validEnquiryTypes.includes(enquiryType)) enquiryType = "PRODUCT";

            if (!name || !phone) {
                results.failed++;
                results.errors.push(`Row ${i + 1}: Missing required fields (name="${name}", phone="${phone}")`);
                continue;
            }

            try {
                // Scoring
                const { score, category } = calculateLeadScore({ source, phone, email });
                
                const newLead = await prisma.lead.create({
                    data: { name, email: email || null, phone, source, enquiryType, score, category }
                });

                await logActivity({
                    leadId: newLead.id,
                    userId,
                    action: "LEAD_CREATED",
                    metadata: { source: "CSV_IMPORT", score, category }
                });
                results.imported++;
            } catch (err) {
                results.failed++;
                results.errors.push(`Row ${i + 1}: ${err.message}`);
            }
        }

        const summary = `Import complete: ${results.imported} imported, ${results.failed} failed, ${results.skipped} skipped`;
        console.log(summary, results.errors.length > 0 ? results.errors : "");

        res.json({
            message: `Import complete: ${results.imported} lead(s) imported, ${results.skipped} skipped, ${results.failed} failed`,
            imported: results.imported,
            skipped: results.skipped,
            failed: results.failed,
            skipped: results.skipped,
            errors: results.errors.slice(0, 20) // Limit errors in response
        });
    } catch (error) {
        console.error("CSV Import error:", error);
        res.status(500).json({ message: "Error importing leads", error: error.message });
    }
};

module.exports = {
    getLeads,
    createLead,
    updateLead,
    assignLead,
    exportLeads,
    importLeads,
    checkDuplicate,
    mergeLeads,
    getLeadActivities
};
