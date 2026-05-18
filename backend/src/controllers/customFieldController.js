const prisma = require("../utils/prisma");

const listFields = async (req, res) => {
    try {
        const fields = await prisma.customFieldDef.findMany({ orderBy: { order: "asc" } });
        res.json(fields);
    } catch (e) {
        res.status(500).json({ message: "Error fetching custom fields", error: e.message });
    }
};

const createField = async (req, res) => {
    try {
        const { name, fieldKey, type, options, required, order } = req.body;
        if (!name || !fieldKey || !type) {
            return res.status(400).json({ message: "name, fieldKey, and type are required" });
        }
        if (!/^[a-z][a-z0-9_]*$/.test(fieldKey)) {
            return res.status(400).json({ message: "fieldKey must be lowercase letters, numbers, and underscores (e.g. budget_range)" });
        }
        const validTypes = ["TEXT", "NUMBER", "SELECT", "DATE", "CHECKBOX"];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ message: `type must be one of: ${validTypes.join(", ")}` });
        }
        const field = await prisma.customFieldDef.create({
            data: {
                name,
                fieldKey,
                type,
                options: options ?? null,
                required: required ?? false,
                order: order ?? 0,
            },
        });
        res.status(201).json(field);
    } catch (e) {
        if (e.code === "P2002") return res.status(409).json({ message: "A field with this key already exists" });
        res.status(500).json({ message: "Error creating custom field", error: e.message });
    }
};

const updateField = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, options, required, order } = req.body;
        const field = await prisma.customFieldDef.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(options !== undefined && { options }),
                ...(required !== undefined && { required }),
                ...(order !== undefined && { order }),
            },
        });
        res.json(field);
    } catch (e) {
        if (e.code === "P2025") return res.status(404).json({ message: "Field not found" });
        res.status(500).json({ message: "Error updating custom field", error: e.message });
    }
};

const deleteField = async (req, res) => {
    try {
        const { id } = req.params;
        const field = await prisma.customFieldDef.findUnique({ where: { id }, select: { fieldKey: true } });
        if (!field) return res.status(404).json({ message: "Field not found" });

        await prisma.customFieldDef.delete({ where: { id } });

        // Remove the orphaned key from every lead's customFields JSON
        await prisma.$executeRaw`UPDATE "Lead" SET "customFields" = "customFields" - ${field.fieldKey} WHERE "customFields" ? ${field.fieldKey}`;

        res.json({ deleted: true });
    } catch (e) {
        if (e.code === "P2025") return res.status(404).json({ message: "Field not found" });
        res.status(500).json({ message: "Error deleting custom field", error: e.message });
    }
};

// PATCH /leads/:leadId/custom-fields
const saveLeadCustomFields = async (req, res) => {
    try {
        const { leadId } = req.params;
        const { fields } = req.body;
        if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
            return res.status(400).json({ message: "fields must be a plain object" });
        }

        // Only allow keys that exist in CustomFieldDef — prevents arbitrary JSON pollution
        const defs = await prisma.customFieldDef.findMany({ select: { fieldKey: true } });
        const validKeys = new Set(defs.map(d => d.fieldKey));
        const invalidKeys = Object.keys(fields).filter(k => !validKeys.has(k));
        if (invalidKeys.length > 0) {
            return res.status(400).json({ message: `Unknown custom field key(s): ${invalidKeys.join(", ")}` });
        }

        const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { customFields: true } });
        if (!lead) return res.status(404).json({ message: "Lead not found" });

        const updated = await prisma.lead.update({
            where: { id: leadId },
            data: { customFields: { ...(lead.customFields || {}), ...fields } },
        });
        res.json({ customFields: updated.customFields });
    } catch (e) {
        res.status(500).json({ message: "Error saving custom fields", error: e.message });
    }
};

module.exports = { listFields, createField, updateField, deleteField, saveLeadCustomFields };
