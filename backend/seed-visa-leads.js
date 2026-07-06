const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    console.log("Seeding leads in VISA_STATUS and VISA_APPROVAL stages...");

    // 1. Get first active user and their workspace
    const user = await prisma.user.findFirst({
        where: { isActive: true }
    });
    if (!user) {
        console.error("No active user found to assign leads. Please seed users first.");
        return;
    }
    const workspaceId = user.workspaceId;

    // 2. Prepare 6 visa leads (3 for VISA_STATUS, 3 for VISA_APPROVAL)
    const visaLeads = [
        { name: "Rohit Sharma", email: "rohit.sharma@example.com", phone: "+919876543001", country: "United Kingdom", course: "M.Sc. Data Science", university: "University of Greenwich", stage: "VISA_APPROVAL" },
        { name: "Anjali Nair", email: "anjali.nair@example.com", phone: "+919876543002", country: "Canada", course: "MBA", university: "York University", stage: "VISA_APPROVAL" },
        { name: "Deepak Verma", email: "deepak.verma@example.com", phone: "+919876543003", country: "United States", course: "M.S. Computer Science", university: "Northeastern University", stage: "VISA_APPROVAL" },
        
        { name: "Siddharth Sen", email: "siddharth.sen@example.com", phone: "+919876543006", country: "United Kingdom", course: "M.Sc. Finance", university: "King's College London", stage: "VISA_STATUS" },
        { name: "Riya Kapoor", email: "riya.kapoor@example.com", phone: "+919876543007", country: "Germany", course: "M.S. Automotive Engineering", university: "TU Munich", stage: "VISA_STATUS" },
        { name: "Kunal Singhal", email: "kunal.singhal@example.com", phone: "+919876543008", country: "Australia", course: "Master of Cyber Security", university: "Monash University", stage: "VISA_STATUS" }
    ];

    for (let i = 0; i < visaLeads.length; i++) {
        const vl = visaLeads[i];
        
        // Generate a unique leadId
        const leadIdCode = `sch-26-visa-st${i + 1}`;

        // Create Lead
        const lead = await prisma.lead.create({
            data: {
                leadId: leadIdCode,
                name: vl.name,
                email: vl.email,
                phone: vl.phone,
                source: "FACEBOOK",
                category: "HOT",
                score: 90,
                workspaceId,
                customFields: {
                    firstName: vl.name.split(" ")[0],
                    lastName: vl.name.split(" ")[1] || "",
                    email: vl.email,
                    mobileNumber: vl.phone.replace("+91", ""),
                    mobileCountryCode: "91",
                    countryOfEducation: "India",
                    highestLevelOfEducation: "Bachelor's Degree",
                    // Visa fields
                    visa_manager_approved: true,
                    visa_approved_date: vl.stage === "VISA_APPROVAL" ? new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString() : null,
                    embassy_result: vl.stage === "VISA_APPROVAL" ? "Approved" : "Pending",
                    flight_departure_date: vl.stage === "VISA_APPROVAL" ? new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString() : null,
                    // Shortlist details
                    univ_country: vl.country,
                    univ_name: vl.university,
                    univ_course: vl.course,
                }
            }
        });

        // Create LeadDepartment "SALES" with target stage
        const leadDept = await prisma.leadDepartment.create({
            data: {
                leadId: lead.id,
                department: "SALES",
                stage: vl.stage,
                assignedEmployeeId: user.id,
                assignedAt: new Date()
            }
        });

        // Create Stage Changed Activity
        await prisma.activity.create({
            data: {
                leadId: lead.id,
                userId: user.id,
                action: "STAGE_CHANGED",
                metadata: {
                    department: "SALES",
                    from: "VISA_DOCUMENTATION",
                    to: vl.stage
                }
            }
        });

        console.log(`Successfully seeded lead: ${vl.name} (LeadID: ${lead.leadId}) in stage ${vl.stage} assigned to ${user.name}`);
    }

    console.log("Seeding completed successfully.");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
