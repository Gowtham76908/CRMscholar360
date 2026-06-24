const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    // Find a lead that is in the ENQUIRY stage in the SALES department
    const salesLeadDept = await prisma.leadDepartment.findFirst({
        where: {
            department: "SALES",
            stage: "ENQUIRY"
        },
        include: {
            lead: true
        }
    });

    if (!salesLeadDept || !salesLeadDept.lead) {
        console.log("No leads found in the SALES ENQUIRY stage.");
        // Fall back to any lead
        const anyLead = await prisma.lead.findFirst();
        if (!anyLead) {
            console.log("No leads found in the database at all.");
            return;
        }
        await seedCallLogFor(anyLead);
        return;
    }

    await seedCallLogFor(salesLeadDept.lead);
}

async function seedCallLogFor(lead) {
    const callLog = await prisma.callLog.create({
        data: {
            leadId: lead.id,
            duration: 120,
            callType: "OUTBOUND",
            callStatus: "ANSWERED",
            summary: "Introductory call completed. Student wants to pursue postgraduate studies in Canada. Set follow-up for next week.",
            plainText: "Hello John, this is Scholar360 calling. Yes, we received your inquiry. I understand you are looking at Canadian universities. Let me send over the shortlist.",
            isTranscribed: true
        }
    });

    console.log("SUCCESSFULLY SEEDED CALL LOG:");
    console.log(`- Lead Name: ${lead.name}`);
    console.log(`- Lead ID: ${lead.id}`);
    console.log(`- Call Log ID: ${callLog.id}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
