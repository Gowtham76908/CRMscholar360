const express = require("express");
const router = express.Router();
const { sendEmail } = require("../services/emailService");

// Generate iCal (.ics) content for a calendar invite
function generateICS({ summary, description, startDateTime, endDateTime, organizer, attendeeEmail }) {
    const formatDate = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const uid = `demo-${Date.now()}@zenxai.io`;
    const now = formatDate(new Date());
    const start = formatDate(new Date(startDateTime));
    const end = formatDate(new Date(endDateTime));

    return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//ZenXAI CRM//Demo Booking//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${now}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
        `ORGANIZER;CN=ZenXAI CRM:mailto:${organizer}`,
        `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN=${attendeeEmail}:mailto:${attendeeEmail}`,
        "STATUS:CONFIRMED",
        "SEQUENCE:0",
        "BEGIN:VALARM",
        "TRIGGER:-PT30M",
        "ACTION:DISPLAY",
        "DESCRIPTION:ZenXAI Demo in 30 minutes",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
    ].join("\r\n");
}

// POST /api/demo-booking
router.post("/", async (req, res) => {
    try {
        const { companyName, email, phone, date, time } = req.body;

        if (!companyName || !email || !phone || !date || !time) {
            return res.status(400).json({ error: "All fields are required." });
        }

        // Build start/end datetime (1 hour demo)
        const [year, month, day] = date.split("-").map(Number);
        const [hours, minutes] = time.split(":").map(Number);
        const startDT = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
        const endDT = new Date(startDT.getTime() + 60 * 60 * 1000); // +1 hour

        const formattedDate = startDT.toLocaleDateString("en-IN", {
            weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
        });
        const formattedTime = `${time} (IST)`;

        const icsContent = generateICS({
            summary: `ZenXAI Demo – ${companyName}`,
            description: `Demo booking details:\nCompany: ${companyName}\nContact: ${email}\nPhone: ${phone}\nDate: ${formattedDate}\nTime: ${formattedTime}`,
            startDateTime: startDT,
            endDateTime: endDT,
            organizer: process.env.SMTP_FROM,
            attendeeEmail: email,
        });

        const adminEmail = process.env.SMTP_FROM;

        // 1. Notify admin with calendar invite
        await sendEmail({
            to: adminEmail,
            subject: `New Demo Booking – ${companyName}`,
            html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:12px;">
                    <div style="background:linear-gradient(135deg,#1e2d6b,#0d9488);padding:24px 32px;border-radius:10px;margin-bottom:24px;">
                        <h1 style="color:#fff;margin:0;font-size:22px;">New Demo Booking</h1>
                        <p style="color:#a7f3d0;margin:4px 0 0;font-size:14px;">ZenXAI CRM</p>
                    </div>
                    <div style="background:#fff;padding:24px;border-radius:10px;border:1px solid #e5e7eb;">
                        <table style="width:100%;border-collapse:collapse;">
                            <tr><td style="padding:10px 0;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;">Company</td><td style="padding:10px 0;font-weight:600;color:#111827;">${companyName}</td></tr>
                            <tr><td style="padding:10px 0;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;">Email</td><td style="padding:10px 0;font-weight:600;color:#111827;">${email}</td></tr>
                            <tr><td style="padding:10px 0;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;">Phone</td><td style="padding:10px 0;font-weight:600;color:#111827;">${phone}</td></tr>
                            <tr><td style="padding:10px 0;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;">Date</td><td style="padding:10px 0;font-weight:600;color:#111827;">${formattedDate}</td></tr>
                            <tr><td style="padding:10px 0;color:#6b7280;font-size:14px;">Time</td><td style="padding:10px 0;font-weight:600;color:#111827;">${formattedTime}</td></tr>
                        </table>
                    </div>
                    <p style="color:#9ca3af;font-size:12px;margin-top:16px;text-align:center;">A calendar invite (.ics) is attached. Accept it to add to your calendar.</p>
                </div>
            `,
            text: `New Demo Booking\nCompany: ${companyName}\nEmail: ${email}\nPhone: ${phone}\nDate: ${formattedDate}\nTime: ${formattedTime}`,
            attachments: [
                {
                    filename: "demo-invite.ics",
                    content: icsContent,
                    contentType: "text/calendar; method=REQUEST",
                },
            ],
        });

        // 2. Send confirmation to prospect
        await sendEmail({
            to: email,
            subject: `Your ZenXAI Demo is Confirmed – ${formattedDate}`,
            html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:12px;">
                    <div style="background:linear-gradient(135deg,#1e2d6b,#0d9488);padding:24px 32px;border-radius:10px;margin-bottom:24px;">
                        <h1 style="color:#fff;margin:0;font-size:22px;">Demo Confirmed!</h1>
                        <p style="color:#a7f3d0;margin:4px 0 0;font-size:14px;">ZenXAI CRM – AI-Powered Sales Engine</p>
                    </div>
                    <div style="background:#fff;padding:24px;border-radius:10px;border:1px solid #e5e7eb;">
                        <p style="color:#374151;margin:0 0 16px;">Hi <strong>${companyName}</strong>,</p>
                        <p style="color:#374151;margin:0 0 16px;">Your demo has been booked successfully. Here are your details:</p>
                        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:16px;">
                            <p style="margin:0 0 8px;color:#166534;font-weight:600;">📅 ${formattedDate}</p>
                            <p style="margin:0;color:#166534;font-weight:600;">⏰ ${formattedTime}</p>
                        </div>
                        <p style="color:#374151;margin:0 0 16px;">In your 45-minute demo, you'll see:</p>
                        <ul style="color:#374151;margin:0 0 16px;padding-left:20px;">
                            <li style="margin-bottom:8px;">Live AI Voice Agent making a real call</li>
                            <li style="margin-bottom:8px;">WhatsApp Chatbot qualifying a lead in real time</li>
                            <li style="margin-bottom:8px;">Your dashboard with sample pipeline data</li>
                            <li>A personalised ROI calculation for your business</li>
                        </ul>
                        <p style="color:#6b7280;font-size:13px;margin:0;">Questions? Contact us at <a href="mailto:hello@zenxai.io" style="color:#0d9488;">hello@zenxai.io</a> or WhatsApp <a href="https://wa.me/919003103018" style="color:#0d9488;">+91 9003103018</a></p>
                    </div>
                </div>
            `,
            text: `Demo Confirmed!\nDate: ${formattedDate}\nTime: ${formattedTime}\nWe'll see you then!`,
            attachments: [
                {
                    filename: "zenxai-demo.ics",
                    content: icsContent,
                    contentType: "text/calendar; method=REQUEST",
                },
            ],
        });

        res.json({ success: true, message: "Demo booked successfully! Check your email for confirmation." });
    } catch (error) {
        console.error("[DEMO BOOKING ERROR]", error.message);
        res.status(500).json({ error: "Failed to book demo. Please try again." });
    }
});

module.exports = router;
