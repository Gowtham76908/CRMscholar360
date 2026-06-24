require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("crypto");
const prisma = new PrismaClient();

const STUDENT_JOURNEY_FIELDS = [
    { fieldKey: "interested",                name: "Interested",                type: "CHECKBOX", order: 19 },
    { fieldKey: "ielts_toefl_score",         name: "IELTS/TOEFL Score",         type: "TEXT",     order: 20 },
    { fieldKey: "academic_gpa",              name: "Academic GPA",              type: "TEXT",     order: 21 },
    { fieldKey: "backlogs",                  name: "Backlogs",                  type: "NUMBER",   order: 22 },
    { fieldKey: "target_universities",       name: "Target Universities Chosen", type: "TEXT",     order: 23 },
    { fieldKey: "sop_status",                name: "SOP Status",                type: "SELECT",   options: ["Pending", "Uploaded"], order: 24 },
    { fieldKey: "lor_status",                name: "LOR Status",                type: "SELECT",   options: ["Pending", "Uploaded"], order: 25 },
    { fieldKey: "transcripts_status",        name: "Transcripts Status",        type: "SELECT",   options: ["Pending", "Uploaded"], order: 26 },
    { fieldKey: "application_ref_id",        name: "Application Ref ID",        type: "TEXT",     order: 27 },
    { fieldKey: "submission_date",           name: "Submission Date",           type: "DATE",     order: 28 },
    { fieldKey: "university_response",       name: "University Response",       type: "SELECT",   options: ["Conditional Offer", "Unconditional Offer", "Reject"], order: 29 },
    { fieldKey: "offer_letter_uploaded",     name: "Offer Letter Status",       type: "SELECT",   options: ["Pending", "Uploaded"], order: 30 },
    { fieldKey: "deposit_amount_due",        name: "Deposit Amount Due",        type: "TEXT",     order: 31 },
    { fieldKey: "deposit_receipt_uploaded",   name: "Deposit Receipt Status",    type: "SELECT",   options: ["Pending", "Uploaded"], order: 32 },
    { fieldKey: "financial_proof_docs",      name: "Financial Proof Documents", type: "TEXT",     order: 33 },
    { fieldKey: "cas_form_number",           name: "CAS/I-20 Form Number",      type: "TEXT",     order: 34 },
    { fieldKey: "visa_manager_approved",     name: "Visa Manager Approved",     type: "CHECKBOX", order: 35 },
    { fieldKey: "visa_appointment_date",     name: "Visa Appointment Date",     type: "DATE",     order: 36 },
    { fieldKey: "mock_interview_scorecard",  name: "Mock Interview Scorecard",  type: "TEXT",     order: 37 },
    { fieldKey: "embassy_result",            name: "Embassy Result",            type: "SELECT",   options: ["Approved", "Refused"], order: 38 },
    { fieldKey: "approved_visa_passport",    name: "Approved Visa Passport Page",type: "TEXT",     order: 39 },
    { fieldKey: "flight_departure_date",     name: "Flight Departure Date",     type: "DATE",     order: 40 },
    { fieldKey: "first_year_tuition",        name: "1st Year Tuition Fee Value",type: "TEXT",     order: 41 },
    { fieldKey: "commission_percentage",     name: "Commission Percentage",     type: "TEXT",     order: 42 },
    { fieldKey: "archive_reason",            name: "Reason for Archiving",      type: "TEXT",     order: 43 },
    { fieldKey: "deferred_intake_term",      name: "Deferred Intake Term",      type: "TEXT",     order: 44 },
    { fieldKey: "remind_date",               name: "Remind Date",               type: "DATE",     order: 45 },
];

async function main() {
    console.log("Seeding Student Journey Custom Fields...");
    for (const f of STUDENT_JOURNEY_FIELDS) {
        const existing = await prisma.customFieldDef.findUnique({
            where: { fieldKey: f.fieldKey }
        });
        if (existing) {
            await prisma.customFieldDef.update({
                where: { fieldKey: f.fieldKey },
                data: {
                    name: f.name,
                    type: f.type,
                    options: f.options ? f.options : null,
                    order: f.order,
                    isSystem: false,
                    visible: true,
                }
            });
            console.log(`  Updated field: ${f.fieldKey}`);
        } else {
            await prisma.customFieldDef.create({
                data: {
                    id: randomUUID(),
                    name: f.name,
                    fieldKey: f.fieldKey,
                    type: f.type,
                    options: f.options ? f.options : null,
                    required: false,
                    visible: true,
                    isSystem: false,
                    order: f.order,
                }
            });
            console.log(`  Created field: ${f.fieldKey}`);
        }
    }
    console.log("✓ Student Journey Custom Fields Seeded successfully.");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
