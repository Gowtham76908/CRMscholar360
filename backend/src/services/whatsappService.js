const axios = require("axios");

const wati = axios.create({
    baseURL: process.env.WATI_API_ENDPOINT,
    headers: {
        Authorization: `Bearer ${process.env.WATI_API_TOKEN}`,
        "Content-Type": "application/json",
    },
    timeout: 15_000,
});

async function getTemplates() {
    const res = await wati.get("/api/v1/getMessageTemplates");
    // WATI returns { result: true, messageTemplates: [...] }
    return (res.data?.messageTemplates ?? []).filter(t => t.status === "approved");
}

async function sendTemplateMessage(phone, templateName, parameters = []) {
    // WATI expects phone without + prefix, just digits
    const cleanPhone = phone.replace(/\D/g, "");

    const payload = {
        template_name: templateName,
        broadcast_name: `crm_${Date.now()}`,
        parameters: parameters.map((value, i) => ({
            name: String(i + 1),
            value: String(value),
        })),
    };

    const res = await wati.post(
        `/api/v1/sendTemplateMessage?whatsappNumber=${cleanPhone}`,
        payload
    );

    return {
        watiMessageId: res.data?.id ?? null,
        status: res.data?.result === true ? "SENT" : "FAILED",
        raw: res.data,
    };
}

module.exports = { getTemplates, sendTemplateMessage };
