const ProviderInterface = require("./ProviderInterface");
const prisma = require("../../utils/prisma");
const leadService = require("../leadService");

// Minimal RFC-4180 CSV parser. Keeps every cell as text (so phone numbers keep
// their leading "+"/zeros instead of being coerced to numbers) and handles
// quoted fields containing commas and newlines.
function parseCSV(text) {
    const rows = [];
    let cur = [], field = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else field += c;
        } else if (c === '"') { inQuotes = true; }
        else if (c === ",") { cur.push(field); field = ""; }
        else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
        else if (c !== "\r") { field += c; }
    }
    if (field.length || cur.length) { cur.push(field); rows.push(cur); }
    return rows;
}

// Pulls leads from a Google Sheet that is shared as "Anyone with the link: Viewer"
// (or Published to web). No OAuth — we fetch the sheet's CSV export and parse it.
// Runs on demand from the Integration Hub or the board's Sync button.
class GoogleSheetsProvider extends ProviderInterface {
    // Connected sheet URLs. Stored as config.sheets (array of URL strings); falls
    // back to the legacy single config.sheetUrl for older saved configs.
    _sheetUrls() {
        const cfg = this.integration?.config || {};
        const list = Array.isArray(cfg.sheets) ? cfg.sheets : (cfg.sheetUrl ? [cfg.sheetUrl] : []);
        return list.map(s => (typeof s === "string" ? s : s?.url)).map(u => (u || "").trim()).filter(Boolean);
    }

    // Turn a Google Sheets URL into its anonymous CSV export URL.
    _csvUrl(url) {
        if (!url) return null;
        const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (!idMatch) return null;
        const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
        const gid = gidMatch ? gidMatch[1] : "0";
        return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;
    }

    async _fetchRows(url) {
        const csvUrl = this._csvUrl(url);
        if (!csvUrl) throw new Error(`Not a valid Google Sheet URL: ${url}`);
        const res = await fetch(csvUrl, { redirect: "follow" });
        const text = await res.text();
        // A private/unshared sheet redirects to an HTML sign-in page instead of CSV.
        if (!res.ok || /^\s*</.test(text)) {
            throw new Error(
                "Could not read the sheet. In Google Sheets → Share, set access to " +
                "\"Anyone with the link → Viewer\" (or File → Share → Publish to web), then try again."
            );
        }
        const matrix = parseCSV(text);
        if (matrix.length < 2) return [];
        const headers = matrix[0].map(h => String(h).trim());
        return matrix.slice(1)
            .filter(r => r.some(c => String(c).trim() !== ""))   // skip fully-blank rows
            .map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
    }

    // Map a sheet row (arbitrary header names) to lead fields.
    _mapRow(row) {
        const fields = {};
        for (const [k, v] of Object.entries(row)) {
            fields[String(k).trim().toLowerCase()] = typeof v === "string" ? v.trim() : v;
        }
        const find = (patterns) => {
            for (const [k, v] of Object.entries(fields)) {
                if (v && patterns.some(p => k.includes(p))) return v;
            }
            return null;
        };
        const email = fields.email || find(["email", "e-mail", "mail"]) ||
            Object.values(fields).find(v => typeof v === "string" && /@/.test(v)) || null;
        const phone = fields.phone || fields.mobile || find(["phone", "mobile", "contact", "whatsapp", "number"]) || null;
        const name = fields.name || fields["full name"] || find(["name"]) ||
            [find(["first"]), find(["last"])].filter(Boolean).join(" ").trim() || null;
        const course = fields.course || find(["course", "program", "programme", "interested"]) || null;
        const message = fields.message || fields.notes || find(["message", "note", "enquiry", "inquiry", "comment", "query", "remark"]) || null;
        return { name, email: email || null, phone: phone || null, course: course || null, message: message || null };
    }

    async validate() {
        const urls = this._sheetUrls();
        if (!urls.length) return { ok: false, message: "Add at least one Google Sheet URL and Save." };
        let totalRows = 0;
        for (const url of urls) {
            try {
                const rows = await this._fetchRows(url);
                totalRows += rows.length;
            } catch (err) {
                return { ok: false, message: `${err.message}` };
            }
        }
        return { ok: true, message: `${urls.length} sheet${urls.length === 1 ? "" : "s"} connected — ${totalRows} row${totalRows === 1 ? "" : "s"} total` };
    }

    async sync() {
        const urls = this._sheetUrls();
        if (!urls.length) throw new Error("No Google Sheet connected — add a sheet URL and Save first.");

        let synced = 0, rowsSeen = 0, skippedExisting = 0, skippedNoContact = 0;
        for (const url of urls) {
            const rows = await this._fetchRows(url);
            for (const row of rows) {
                rowsSeen++;
                const { name, email, phone, course, message } = this._mapRow(row);
                if (!email && !phone) { skippedNoContact++; continue; }

                // Dedup against any existing lead by email or phone.
                const or = [];
                if (email) or.push({ email });
                if (phone) or.push({ phone });
                const existing = or.length ? await prisma.lead.findFirst({ where: { OR: or } }) : null;
                if (existing) { skippedExisting++; continue; }

                // No dedicated "course" column on Lead, so keep it in biodata with the message.
                const biodata = [course ? `Course: ${course}` : null, message].filter(Boolean).join("\n") || null;

                await leadService.createLead({
                    name: name || "Google Sheet Lead",
                    email: email || null,
                    phone: phone || null,
                    source: "SHEETS",
                    enquiryType: "SERVICES",
                    biodata,
                });
                synced++;
            }
        }

        const details = { synced, sheets: urls.length, rowsSeen, skippedExisting, skippedNoContact };
        console.log("[GoogleSheetsSync]", JSON.stringify(details));
        return details;
    }

    async disconnect() {
        return { ok: true };
    }
}

module.exports = GoogleSheetsProvider;
