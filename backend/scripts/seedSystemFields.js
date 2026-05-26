require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("crypto");
const p = new PrismaClient();

const SYSTEM_FIELDS = [
    { fieldKey: "name",        name: "Full Name",    type: "TEXT",   required: true,  visible: true,  order: 1 },
    { fieldKey: "phone",       name: "Phone",        type: "TEXT",   required: false, visible: true,  order: 2 },
    { fieldKey: "email",       name: "Email",        type: "TEXT",   required: false, visible: true,  order: 3 },
    { fieldKey: "company",     name: "Company",      type: "TEXT",   required: false, visible: true,  order: 4 },
    { fieldKey: "source",      name: "Lead Source",  type: "SELECT", required: true,  visible: true,  order: 5,
      options: ["FACEBOOK", "INSTAGRAM", "GMAIL", "WEBSITE", "PHONE_CALL", "LINKEDIN"] },
    { fieldKey: "enquiryType", name: "Enquiry Type", type: "SELECT", required: false, visible: true,  order: 6,
      options: ["PRODUCT", "WHITE_LABEL", "LMS", "SERVICES"] },
    { fieldKey: "biodata",     name: "Description",  type: "TEXTAREA",required: false, visible: true, order: 7 },
    { fieldKey: "jobTitle",    name: "Job Title",    type: "TEXT",   required: false, visible: false, order: 8 },
    { fieldKey: "linkedinUrl", name: "LinkedIn URL", type: "TEXT",   required: false, visible: false, order: 9 },
    { fieldKey: "category",    name: "Category",     type: "TEXT",   required: false, visible: false, order: 10 },
];

async function main() {
    for (const f of SYSTEM_FIELDS) {
        const existing = await p.$queryRawUnsafe(
            `SELECT id FROM "CustomFieldDef" WHERE "fieldKey" = $1`, f.fieldKey
        );
        if (existing.length > 0) {
            await p.$executeRawUnsafe(
                `UPDATE "CustomFieldDef" SET "isSystem" = true, "name" = $1, "type" = $2, "required" = $3, "order" = $4
                 WHERE "fieldKey" = $5`,
                f.name, f.type, f.required, f.order, f.fieldKey
            );
            console.log(`  Updated system field: ${f.fieldKey}`);
        } else {
            await p.$executeRawUnsafe(
                `INSERT INTO "CustomFieldDef" (id, name, "fieldKey", type, options, required, visible, "isSystem", "order", "createdAt")
                 VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, true, $8, NOW())`,
                randomUUID(), f.name, f.fieldKey, f.type,
                f.options ? JSON.stringify(f.options) : null,
                f.required, f.visible, f.order
            );
            console.log(`  Created system field: ${f.fieldKey}`);
        }
    }
    console.log("\n✓ System fields seeded.");
}

main().catch(console.error).finally(() => p.$disconnect());
