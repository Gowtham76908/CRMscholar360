const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
    console.log("Seeding activity logs for lead 'sch-26-0121'...");

    // 1. Find or create a user to associate with the activities
    let user = await prisma.user.findFirst();
    if (!user) {
        user = await prisma.user.create({
            data: {
                name: "System Admin",
                email: "admin@crmscholar360.com",
                role: "SUPER_ADMIN",
            }
        });
        console.log("Created a dummy admin user:", user.email);
    }

    // 2. Find or create the lead 'sch-26-0121'
    let lead = await prisma.lead.findFirst({
        where: {
            OR: [
                { leadId: "sch-26-0121" },
                { name: "sch-26-0121" }
            ]
        }
    });

    if (!lead) {
        lead = await prisma.lead.create({
            data: {
                leadId: "sch-26-0121",
                name: "Gowtham Gowda",
                email: "gowtham@example.com",
                phone: "+919876543210",
                source: "FACEBOOK",
                category: "HOT",
                score: 85,
            }
        });
        console.log("Created lead 'sch-26-0121' (ID:", lead.id, ")");
    } else {
        console.log("Found existing lead 'sch-26-0121' (ID:", lead.id, ")");
        
        // Clean up existing relation data to ensure clean seeding
        await prisma.activity.deleteMany({ where: { leadId: lead.id } });
        await prisma.note.deleteMany({ where: { leadId: lead.id } });
        await prisma.callLog.deleteMany({ where: { leadId: lead.id } });
        await prisma.whatsAppMessage.deleteMany({ where: { leadId: lead.id } });
        await prisma.emailLog.deleteMany({ where: { leadId: lead.id } });
        console.log("Cleaned up existing activities/messages/notes for this lead.");
    }

    // 3. Seed activities
    const now = new Date();
    
    // a. Basic activities
    console.log("Seeding base activities...");
    await prisma.activity.createMany({
        data: [
            {
                leadId: lead.id,
                userId: user.id,
                action: "LEAD_CREATED",
                metadata: { source: "FACEBOOK_REALTIME", category: "HOT", score: 85 },
                createdAt: new Date(now.getTime() - 5 * 24 * 3600 * 1000) // 5 days ago
            },
            {
                leadId: lead.id,
                userId: user.id,
                action: "LEAD_ASSIGNED",
                metadata: { assignedToName: user.name, assignedTo: user.id },
                createdAt: new Date(now.getTime() - 4.5 * 24 * 3600 * 1000)
            },
            {
                leadId: lead.id,
                userId: user.id,
                action: "STAGE_UPDATED",
                metadata: { department: "VISA", from: "NEW", to: "IN_PROGRESS" },
                createdAt: new Date(now.getTime() - 3 * 24 * 3600 * 1000)
            }
        ]
    });

    // b. Note
    console.log("Seeding notes...");
    await prisma.note.create({
        data: {
            leadId: lead.id,
            userId: user.id,
            content: "Spoke to Gowtham. He is very interested in the UK Visa process. He will upload his documents by tomorrow.",
            createdAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000)
        }
    });

    // c. Call logs
    console.log("Seeding call logs...");
    await prisma.callLog.create({
        data: {
            leadId: lead.id,
            userId: user.id,
            duration: 185,
            callType: "OUTBOUND",
            callStatus: "COMPLETED",
            isTranscribed: true,
            transcription: "Agent: Hello Gowtham. Gowtham: Yes, hello. Agent: I am calling from CRM Scholar. Gowtham: Ah yes, I need to upload my documents. Agent: Sure, please do it over WhatsApp or Portal.",
            summary: "Discussed document upload procedure. Gowtham promised to upload Cas letter today.",
            createdAt: new Date(now.getTime() - 1.5 * 24 * 3600 * 1000)
        }
    });

    // d. WhatsApp Messages (text messages)
    console.log("Seeding WhatsApp messages...");
    
    // Inbound query
    const m1 = await prisma.whatsAppMessage.create({
        data: {
            leadId: lead.id,
            userId: null,
            phone: lead.phone || "+919876543210",
            direction: "INBOUND",
            messageBody: "Hi, I want to update my UK visa details.",
            status: "READ",
            createdAt: new Date(now.getTime() - 20 * 3600 * 1000)
        }
    });



    // Inbound reply
    await prisma.whatsAppMessage.create({
        data: {
            leadId: lead.id,
            userId: null,
            phone: lead.phone || "+919876543210",
            direction: "INBOUND",
            messageBody: "I have uploaded the CAS form and my financial statement. Can you review them?",
            status: "READ",
            createdAt: new Date(now.getTime() - 4 * 3600 * 1000)
        }
    });

    // e. Attachments (RESUME_UPLOADED activity)
    console.log("Seeding attachments...");
    
    // PDF Attachment
    await prisma.activity.create({
        data: {
            leadId: lead.id,
            userId: user.id,
            action: "RESUME_UPLOADED",
            metadata: {
                resumeUrl: "/uploads/resumes/uk_visa_cas_form.pdf",
                resumeName: "uk_visa_cas_form.pdf",
                uploadedBy: lead.name
            },
            createdAt: new Date(now.getTime() - 3.8 * 3600 * 1000)
        }
    });

    // Word Doc Attachment
    await prisma.activity.create({
        data: {
            leadId: lead.id,
            userId: user.id,
            action: "RESUME_UPLOADED",
            metadata: {
                resumeUrl: "/uploads/resumes/financial_statement.docx",
                resumeName: "financial_statement.docx",
                uploadedBy: lead.name
            },
            createdAt: new Date(now.getTime() - 3.5 * 3600 * 1000)
        }
    });

    // f. Email logs
    console.log("Seeding email logs...");
    await prisma.emailLog.create({
        data: {
            lead: { connect: { id: lead.id } },
            sentBy: { connect: { id: user.id } },
            toEmail: lead.email || "gowtham@example.com",
            subject: "UK Visa Application Checklist & Documents Review",
            body: "Hi Gowtham,\n\nWe have received your CAS form and financial statements. We will review them and update your stages shortly.\n\nRegards,\nCRM Scholar Team",
            createdAt: new Date(now.getTime() - 2 * 3600 * 1000)
        }
    });

    console.log("Successfully seeded all activities for Gowtham Gowda (sch-26-0121)!");
}

main()
    .catch((e) => {
        console.error("Error seeding activities:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
