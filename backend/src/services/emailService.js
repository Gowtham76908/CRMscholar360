const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const sendEmail = async ({ to, subject, text, html, attachments }) => {
    try {
        await transporter.sendMail({
            from: `"ZenXAI CRM" <${process.env.SMTP_FROM}>`,
            to,
            subject,
            text,
            html,
            ...(attachments ? { attachments } : {}),
        });
        console.log(`[EMAIL SENT] To: ${to} | Subject: ${subject}`);
        return true;
    } catch (error) {
        console.error(`[EMAIL ERROR] ${error.message}`);
        throw error;
    }
};

const sendWelcomeEmail = async (lead) => {
    const subject = "Welcome to ZX CRM Services!";
    const text = `Hi ${lead.name},\n\nThanks for your enquiry regarding ${lead.enquiryType}. Our team will reach out to you shortly.\n\nBest,\nZX CRM Team`;
    return await sendEmail({ to: lead.email, subject, text });
};

const sendReminderEmail = async (user, reminder) => {
    return await sendEmail({
        to: user.email,
        subject: "Reminder: " + reminder.message.substring(0, 30) + "...",
        text: `Hi ${user.name},\n\nYou have a reminder set for now:\n\n"${reminder.message}"\n\nPlease check your tasks.`,
    });
};

const sendInvoiceEmail = async ({ to, invoice, items, company }) => {
    const co = company || {};
    const coName    = co.companyName || "Hexite Technologies Private Limited";
    const coGstin   = co.gstin       || "33AAHCH4159D1ZT";
    const coAddress = co.address     || "No 98, Varadharajan Street Kaladipet";
    const coCity    = `${co.city || "Chennai"}, ${co.state || "Tamil Nadu"} - ${co.pincode || "600019"}`;
    const coPhone   = co.phone       || "+91 9994081905";
    const coEmail   = co.email       || "praveen@hexitetechnologies.com";
    const bankName  = co.bankName    || "Axis Bank";
    const accountNo = co.accountNo   || "924020046598227";
    const ifsc      = co.ifsc        || "UTIB0001619";
    const branch    = co.branch      || "Thiruvottriyur";
    const subject = `${invoice.invoiceType === "PROFORMA" ? "Proforma Invoice" : "Tax Invoice"} #${invoice.invoiceNumber} from ${coName}`;

    const itemRows = items.map((item, i) => `
        <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#374151;">${i + 1}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#374151;">${item.description}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#374151;text-align:right;">₹${Number(item.price).toFixed(2)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#374151;text-align:right;">₹${Number(item.taxableValue).toFixed(2)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#374151;text-align:right;">₹${Number(item.amount - item.taxableValue).toFixed(2)} (${item.taxRate}%)</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#374151;text-align:right;font-weight:600;">₹${Number(item.amount).toFixed(2)}</td>
        </tr>`).join("");

    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Invoice</title></head>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
        <div style="max-width:800px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
            <!-- Header -->
            <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 40px;color:#fff;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div>
                        <h1 style="margin:0 0 4px;font-size:26px;font-weight:800;letter-spacing:-0.5px;">${coName.toUpperCase()}</h1>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:22px;font-weight:700;letter-spacing:1px;">${invoice.invoiceType === "PROFORMA" ? "PROFORMA INVOICE" : "TAX INVOICE"}</div>
                        <div style="margin-top:6px;opacity:0.85;font-size:13px;">#${invoice.invoiceNumber}</div>
                        <div style="opacity:0.85;font-size:13px;">Date: ${new Date(invoice.createdAt).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}</div>
                    </div>
                </div>
            </div>

            <div style="padding:32px 40px;">
                <!-- From / To -->
                <div style="display:flex;gap:40px;margin-bottom:32px;">
                    <div style="flex:1;">
                        <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">From</p>
                        <p style="margin:0 0 3px;font-weight:700;color:#111827;">${coName}</p>
                        <p style="margin:0 0 2px;color:#6b7280;font-size:13px;">GSTIN: ${coGstin}</p>
                        <p style="margin:0 0 2px;color:#6b7280;font-size:13px;">${coAddress}</p>
                        <p style="margin:0 0 2px;color:#6b7280;font-size:13px;">${coCity}</p>
                        <p style="margin:0 0 2px;color:#6b7280;font-size:13px;">${coPhone}</p>
                        <p style="margin:0;color:#6b7280;font-size:13px;">${coEmail}</p>
                    </div>
                    <div style="flex:1;">
                        <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Bill To</p>
                        <p style="margin:0 0 3px;font-weight:700;color:#111827;">${invoice.clientName}</p>
                        ${invoice.clientGstin ? `<p style="margin:0 0 2px;color:#6b7280;font-size:13px;">GSTIN: ${invoice.clientGstin}</p>` : ""}
                        ${invoice.clientAddress ? `<p style="margin:0 0 2px;color:#6b7280;font-size:13px;">${invoice.clientAddress}</p>` : ""}
                        ${invoice.clientPhone ? `<p style="margin:0 0 2px;color:#6b7280;font-size:13px;">${invoice.clientPhone}</p>` : ""}
                        ${invoice.clientEmail ? `<p style="margin:0;color:#6b7280;font-size:13px;">${invoice.clientEmail}</p>` : ""}
                    </div>
                </div>

                <!-- Items Table -->
                <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
                    <thead>
                        <tr style="background:#f3f4f6;">
                            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">#</th>
                            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Item / Description</th>
                            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;">Price</th>
                            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;">Taxable Value</th>
                            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;">Tax Amount</th>
                            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>${itemRows}</tbody>
                </table>

                <!-- Totals -->
                <div style="display:flex;justify-content:flex-end;">
                    <div style="min-width:280px;">
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e5e7eb;">
                            <span style="color:#6b7280;font-size:14px;">Taxable Amount</span>
                            <span style="font-weight:600;color:#111827;">₹${Number(invoice.subtotal).toFixed(2)}</span>
                        </div>
                        ${invoice.cgst > 0 ? `
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e5e7eb;">
                            <span style="color:#6b7280;font-size:14px;">CGST</span>
                            <span style="font-weight:600;color:#111827;">₹${Number(invoice.cgst).toFixed(2)}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e5e7eb;">
                            <span style="color:#6b7280;font-size:14px;">SGST</span>
                            <span style="font-weight:600;color:#111827;">₹${Number(invoice.sgst).toFixed(2)}</span>
                        </div>` : ""}
                        ${invoice.igst > 0 ? `
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e5e7eb;">
                            <span style="color:#6b7280;font-size:14px;">IGST</span>
                            <span style="font-weight:600;color:#111827;">₹${Number(invoice.igst).toFixed(2)}</span>
                        </div>` : ""}
                        <div style="display:flex;justify-content:space-between;padding:12px 16px;background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:8px;margin-top:8px;">
                            <span style="font-size:16px;font-weight:700;color:#fff;">Total</span>
                            <span style="font-size:18px;font-weight:800;color:#fff;">₹${Number(invoice.total).toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <!-- Bank Details -->
                <div style="margin-top:32px;padding:20px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
                    <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Bank Details</p>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                        <span style="font-size:13px;color:#6b7280;">Bank: <strong style="color:#111827;">${bankName}</strong></span>
                        <span style="font-size:13px;color:#6b7280;">Account #: <strong style="color:#111827;">${accountNo}</strong></span>
                        <span style="font-size:13px;color:#6b7280;">IFSC: <strong style="color:#111827;">${ifsc}</strong></span>
                        <span style="font-size:13px;color:#6b7280;">Branch: <strong style="color:#111827;">${branch}</strong></span>
                    </div>
                </div>

                ${invoice.notes ? `<div style="margin-top:16px;padding:16px;background:#fffbeb;border-radius:8px;border:1px solid #fde68a;"><p style="margin:0;font-size:13px;color:#92400e;"><strong>Note:</strong> ${invoice.notes}</p></div>` : ""}
            </div>

            <div style="padding:20px 40px;background:#f3f4f6;text-align:center;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;color:#9ca3af;">This is a digitally generated document. For queries contact ${coEmail}</p>
            </div>
        </div>
    </body>
    </html>`;

    return await sendEmail({ to, subject, html, text: `Invoice #${invoice.invoiceNumber} - Total: ₹${Number(invoice.total).toFixed(2)}` });
};

module.exports = {
    sendEmail,
    sendWelcomeEmail,
    sendReminderEmail,
    sendInvoiceEmail,
};
