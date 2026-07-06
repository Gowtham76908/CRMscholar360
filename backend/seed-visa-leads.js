const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    console.log("Seeding leads in VISA_APPROVAL stage...");

    // 1. Get first active user and their workspace
    const user = await prisma.user.findFirst({
        where: { isActive: true }
    });
    if (!user) {
        console.error("No active user found to assign leads. Please seed users first.");
        return;
    }
    const workspaceId = user.workspaceId;

    // 2. Prepare 5 visa approval leads
    const visaLeads = [
        { name: "Rohit Sharma", email: "rohit.sharma@example.com", phone: "+919876543001", country: "United Kingdom", course: "M.Sc. Data Science", university: "University of Greenwich" },
        { name: "Anjali Nair", email: "anjali.nair@example.com", phone: "+919876543002", country: "Canada", course: "MBA", university: "York University" },
        { name: "Deepak Verma", email: "deepak.verma@example.com", phone: "+919876543003", country: "United States", course: "M.S. Computer Science", university: "Northeastern University" },
        { name: "Sneha Reddy", email: "sneha.reddy@example.com", phone: "+919876543004", country: "Australia", course: "Master of Professional Accounting", university: "University of Sydney" },
        { name: "Vikram Malhotra", email: "vikram.malhotra@example.com", phone: "+919876543005", country: "Ireland", course: "M.Sc. Business Analytics", university: "Trinity College Dublin" }
    ];

    for (let i = 0; i < visaLeads.length; i++) {
        const vl = visaLeads[i];
        
        // Generate a unique leadId
        const leadIdCode = `sch-26-visa${i + 1}`;

        // Create Lead
        const lead = await prisma.lead.create({
            data: {
                leadId: leadIdCode,
                name: vl.name,
                email: vl.email,
                phone: vl.phone,
                source: "FACEBOOK",
                category: "HOT",
                score: 95,
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
                    visa_approved_date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
                    embassy_result: "Approved",
                    flight_departure_date: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString(),
                    // Shortlist details
                    univ_country: vl.country,
                    univ_name: vl.university,
                    univ_course: vl.course,
                }
            }
        });

        // Create LeadDepartment "SALES" with VISA_APPROVAL stage
        const leadDept = await prisma.leadDepartment.create({
            data: {
                leadId: lead.id,
                department: "SALES",
                stage: "VISA_APPROVAL",
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
                    from: "VISA_STATUS",
                    to: "VISA_APPROVAL"
                }
            }
        });

        console.log(`Successfully seeded lead: ${vl.name} (LeadID: ${lead.leadId}) assigned to ${user.name}`);
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
