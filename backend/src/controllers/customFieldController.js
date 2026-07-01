const prisma = require("../utils/prisma");
const { ApiError } = require("../utils/apiError");
const { canAccessLead } = require("../services/permissionService");

const SYSTEM_KEYS = new Set([
    "name", "phone", "email", "company", "source", "enquiryType",
    "biodata", "jobTitle", "linkedinUrl", "category",
]);

const listFields = async (req, res, next) => {
    try {
        const fields = await prisma.customFieldDef.findMany({ orderBy: { order: "asc" } });
        res.json(fields);
    } catch (e) {
        return next(e);
    }
};

const createField = async (req, res, next) => {
    try {
        const { name, fieldKey, type, options, required, order } = req.body;
        if (!name || !fieldKey || !type) {
            return res.status(400).json({ message: "name, fieldKey, and type are required" });
        }
        if (!/^[a-z][a-z0-9_]*$/.test(fieldKey)) {
            return res.status(400).json({ message: "fieldKey must be lowercase letters/numbers/underscores" });
        }
        if (SYSTEM_KEYS.has(fieldKey)) {
            return res.status(400).json({ message: `"${fieldKey}" is a reserved system field key` });
        }
        const validTypes = ["TEXT", "TEXTAREA", "NUMBER", "SELECT", "DATE", "CHECKBOX"];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ message: `type must be one of: ${validTypes.join(", ")}` });
        }
        const field = await prisma.customFieldDef.create({
            data: { name, fieldKey, type, options: options ?? null, required: required ?? false, order: order ?? 0 },
        });
        res.status(201).json(field);
    } catch (e) {
        if (e.code === "P2002") return next(e);
        return next(e);
    }
};

const updateField = async (req, res, next) => {
    try {
        const { id } = req.params;
        const existing = await prisma.customFieldDef.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: "Field not found" });

        const { name, options, required, visible, order } = req.body;
        const data = {};

        // All fields: can update name (label), visible, required
        if (name !== undefined) data.name = name;
        if (visible !== undefined) data.visible = Boolean(visible);
        if (required !== undefined) data.required = Boolean(required);

        // Custom fields only: can update options and order
        if (!existing.isSystem) {
            if (options !== undefined) data.options = options;
            if (order !== undefined) data.order = order;
        }

        const field = await prisma.customFieldDef.update({ where: { id }, data });
        res.json(field);
    } catch (e) {
        if (e.code === "P2025") return next(e);
        return next(e);
    }
};

const deleteField = async (req, res, next) => {
    try {
        const { id } = req.params;
        const field = await prisma.customFieldDef.findUnique({ where: { id }, select: { fieldKey: true, isSystem: true } });
        if (!field) return res.status(404).json({ message: "Field not found" });
        if (field.isSystem) return res.status(400).json({ message: "System fields cannot be deleted. You can hide them instead." });

        await prisma.customFieldDef.delete({ where: { id } });
        await prisma.$executeRaw`UPDATE "Lead" SET "customFields" = "customFields" - ${field.fieldKey} WHERE "customFields" ? ${field.fieldKey}`;

        res.json({ deleted: true });
    } catch (e) {
        if (e.code === "P2025") return next(e);
        return next(e);
    }
};

// PATCH /leads/:leadId/custom-fields  — saves only non-system custom JSON fields
const saveLeadCustomFields = async (req, res, next) => {
    try {
        const { leadId } = req.params;
        const { userId, role } = req.user;
        const { fields } = req.body;
        if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
            return res.status(400).json({ message: "fields must be a plain object" });
        }

        const defs = await prisma.customFieldDef.findMany({ where: { isSystem: false }, select: { fieldKey: true } });
        const validKeys = new Set([
            ...defs.map(d => d.fieldKey),
            // Student Profile Wizard Keys
            "firstName", "middleName", "lastName", "email", "mobileCountryCode", "mobileNumber", "dob", "gender", "maritalStatus",
            "mailingAddress1", "mailingAddress2", "mailingCountry", "mailingState", "mailingCity", "mailingPincode",
            "permAddressSame", "permAddress1", "permAddress2", "permCountry", "permState", "permCity", "permPincode",
            "passportNumber", "passportIssueDate", "passportExpiryDate", "passportIssueCountry", "passportCityOfBirth", "passportCountryOfBirth",
            "nationality", "citizenship", "dualCitizenship", "dualCitizenshipCountries", "otherCountryStudy", "otherCountryStudyName",
            "appliedImmigration", "appliedImmigrationCountry", "medicalCondition", "medicalConditionDetails", "visaRefusal", "visaRefusalCountry", "visaRefusalType",
            "criminalConviction", "criminalConvictionDetails", "emergencyName", "emergencyPhoneCountryCode", "emergencyPhone", "emergencyEmail", "emergencyRelation",
            "countryOfEducation", "highestLevelOfEducation",
            "pgCountry", "pgState", "pgLevel", "pgUniversity", "pgDegree", "pgCity", "pgGrading", "pgPercentage", "pgLanguage", "pgStartDate", "pgEndDate", "pgScore",
            "ugCountry", "ugState", "ugLevel", "ugUniversity", "ugDegree", "ugCity", "ugGrading", "ugScore", "ugLanguage", "ugBacklogs", "ugStartDate", "ugEndDate",
            "x12Country", "x12State", "x12Level", "x12Board", "x12Degree", "x12Institution", "x12City", "x12Grading", "x12Score", "x12Language", "x12StartDate", "x12EndDate", "x12University",
            "x10Country", "x10State", "x10Level", "x10Board", "x10Degree", "x10Institution", "x10City", "x10Grading", "x10Score", "x10Language", "x10StartDate", "x10EndDate", "x10University",
            "hasWorkExperience", "workOrgAddress", "workPosition", "workJobProfile", "workSalaryMode", "workFrom", "workUpto", "workCurrent", "workExperiences",
            "testScores", "documents",
            // Deposit / payment stage keys
            "deposit_amount", "payment_mode", "payment_date", "deposit_history",
            // Visa approval keys
            "visa_approved_date"
        ]);
        const invalidKeys = Object.keys(fields).filter(k => !validKeys.has(k));
        if (invalidKeys.length > 0) {
            return res.status(400).json({ message: `Unknown field key(s): ${invalidKeys.join(", ")}` });
        }

        const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, customFields: true } });
        if (!lead) return res.status(404).json({ message: "Lead not found" });
        if (!(await canAccessLead(userId, role, lead))) {
            return res.status(403).json({ message: "Access denied" });
        }

        const updated = await prisma.lead.update({
            where: { id: leadId },
            data: { customFields: { ...(lead.customFields || {}), ...fields } },
        });

        const visaKeys = ["financial_proof_docs", "cas_form_number", "visa_appointment_date", "visa_manager_approved"];
        const visaChanged = Object.keys(fields).some(k => visaKeys.includes(k));
        if (visaChanged) {
            const logActivity = require("../utils/activityLogger");
            const changedFields = {};
            visaKeys.forEach(k => {
                if (fields[k] !== undefined) {
                    changedFields[k] = fields[k];
                }
            });
            await logActivity({
                leadId,
                userId,
                action: "LEAD_UPDATED",
                metadata: {
                    message: "Updated Visa Documentation Details",
                    changes: changedFields
                }
            });
        }

        // NOTE: SALES stage progression is intentionally manual. Saving custom fields
        // (e.g. university_response, embassy_result) no longer auto-advances the stage —
        // users move the lead forward explicitly via the "Move to next stage" control.

        res.json({ customFields: updated.customFields });
    } catch (e) {
        return next(e);
    }
};

const SYSTEM_FIELD_DEFS = [
    { fieldKey: "name",        name: "Name",          type: "TEXT",     required: true,  order: 0 },
    { fieldKey: "phone",       name: "Phone",         type: "TEXT",     required: false, order: 1 },
    { fieldKey: "email",       name: "Email",         type: "TEXT",     required: false, order: 2 },
    { fieldKey: "company",     name: "Company",       type: "TEXT",     required: false, order: 3 },
    { fieldKey: "source",      name: "Source",        type: "SELECT",   required: false, order: 4,
      options: ["FACEBOOK","INSTAGRAM","GMAIL","WEBSITE","PHONE_CALL","LINKEDIN"] },
    { fieldKey: "enquiryType", name: "Enquiry Type",  type: "SELECT",   required: false, order: 5,
      options: ["PRODUCT","WHITE_LABEL","LMS","SERVICES"] },
    { fieldKey: "biodata",     name: "Bio / Notes",   type: "TEXTAREA", required: false, order: 6 },
    { fieldKey: "jobTitle",    name: "Job Title",     type: "TEXT",     required: false, order: 7 },
    { fieldKey: "linkedinUrl", name: "LinkedIn URL",  type: "TEXT",     required: false, order: 8 },
    { fieldKey: "category",    name: "Category",      type: "SELECT",   required: false, order: 9,
      options: ["COLD","WARM","HOT","PREMIUM"] },
];

const ensureSystemFields = async () => {
    for (const def of SYSTEM_FIELD_DEFS) {
        await prisma.customFieldDef.upsert({
            where: { fieldKey: def.fieldKey },
            update: {},
            create: { ...def, isSystem: true, visible: true, options: def.options ?? null },
        });
    }
};

module.exports = { listFields, createField, updateField, deleteField, saveLeadCustomFields, ensureSystemFields };
