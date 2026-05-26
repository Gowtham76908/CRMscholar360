const axios = require("axios");
const prisma = require("../utils/prisma");
const calculateLeadScore = require("../utils/leadScorer");
const logActivity = require("../utils/activityLogger");

const { decrypt } = require("../utils/encrypt");
const { ApiError } = require("../utils/apiError");
const SERPER_BASE_URL = "https://google.serper.dev";

const getSerperKey = async () => {
    try {
        const intg = await prisma.integration.findUnique({ where: { platform: "linkedin_serper" } });
        if (intg?.config?.apiKey) return decrypt(intg.config.apiKey);
    } catch (_) {}
    return process.env.SERPER_API_KEY || null;
};

// ─── Extraction helpers ───────────────────────────────────────────────────────

const extractEmails = (text) => {
    if (!text) return [];
    const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return text.match(re) || [];
};

const extractPhones = (text) => {
    if (!text) return [];
    // Matches Indian (+91) and generic 10-digit formats
    const re = /(?:\+?91[-.\s]?)?(?:\(?\d{3,5}\)?[-.\s]?)?\d{4,6}[-.\s]?\d{4,5}/g;
    const raw = text.match(re) || [];
    return raw.filter((p) => p.replace(/\D/g, "").length >= 10);
};

// Clean LinkedIn snippet into a readable biodata string
const extractBiodata = (snippet) => {
    if (!snippet) return "";
    return snippet
        .replace(/View\s+\S+(?:'s|s)?\s+profile on LinkedIn[^.]*\.?/gi, "")
        .replace(/\d[\d,+]*\s*connections?/gi, "")
        .replace(/^\s*[^·\n]+·\s*/, "")   // strip leading "City, State · "
        .replace(/\s{2,}/g, " ")
        .trim();
};

// Build a map of keyword → first email found across all organic web results
const buildContactMaps = (organic = []) => {
    const emailMap = {};  // keyword → email
    const phoneMap = {};  // keyword → phone

    organic.forEach((result) => {
        const text = `${result.title || ""} ${result.snippet || ""}`;
        const emails = extractEmails(text);
        const phones = extractPhones(text);

        const keywords = (result.title || "")
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 3);

        keywords.forEach((kw) => {
            if (emails[0] && !emailMap[kw]) emailMap[kw] = emails[0];
            if (phones[0] && !phoneMap[kw]) phoneMap[kw] = phones[0];
        });
    });

    return { emailMap, phoneMap };
};

// Try to match a contact (email/phone) to a lead using name/company keywords
const matchContact = (name, company, map) => {
    const words = `${name} ${company || ""}`
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);

    for (const word of words) {
        if (map[word]) return map[word];
    }
    return "";
};

// ─── LinkedIn result parsers ──────────────────────────────────────────────────

const parsePersonResult = (result, index, emailMap, phoneMap) => {
    const rawTitle = result.title || "";
    const snippet = result.snippet || "";
    const link = result.link || "";

    const title = rawTitle.replace(/\s*[|–-]\s*LinkedIn\s*$/i, "").trim();
    const parts = title.split(/\s+-\s+/);
    const name = parts[0]?.trim() || "Unknown";

    let jobTitle = "";
    let company = "";
    if (parts[1]) {
        const atMatch = parts[1].match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
        if (atMatch) {
            jobTitle = atMatch[1].trim();
            company = atMatch[2].trim();
        } else {
            jobTitle = parts[1].trim();
        }
    }
    if (!company && parts[2]) company = parts[2].trim();

    // Location: LinkedIn snippets often start with "City, State, Country ·"
    const locationMatch = snippet.match(/^([^·\n]{3,60}?)(?:\s*·|\s{2,}|\s*\d)/);
    const location = locationMatch ? locationMatch[1].trim() : "";

    const connectionsMatch = snippet.match(/([\d,+]+)\s*connections?/i);
    const connections = connectionsMatch ? connectionsMatch[1] : null;

    // Try extracting email/phone directly from snippet first, then fall back to map
    const inlineEmails = extractEmails(snippet);
    const inlinePhones = extractPhones(snippet);
    const email = inlineEmails[0] || matchContact(name, company, emailMap) || "";
    const phone = inlinePhones[0] || matchContact(name, company, phoneMap) || "";

    const biodata = extractBiodata(snippet);

    return {
        id: `linkedin_p_${index}_${Date.now()}`,
        name,
        jobTitle,
        company,
        location,
        connections,
        email,
        phone,
        biodata,
        linkedinUrl: link,
        type: "person",
        source: "LINKEDIN",
        enquiryType: "SERVICES"
    };
};

const parseCompanyResult = (result, index, emailMap, phoneMap) => {
    const rawTitle = result.title || "";
    const snippet = result.snippet || "";
    const link = result.link || "";

    const title = rawTitle.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
    const dashIdx = title.indexOf(" - ");
    const name = dashIdx > -1 ? title.slice(0, dashIdx).trim() : title;
    const industry = dashIdx > -1 ? title.slice(dashIdx + 3).trim() : "";

    const followersMatch = snippet.match(/([\d,]+)\s*followers?/i);
    const followers = followersMatch ? followersMatch[1] : null;

    const inlineEmails = extractEmails(snippet);
    const inlinePhones = extractPhones(snippet);
    const email = inlineEmails[0] || matchContact(name, "", emailMap) || "";
    const phone = inlinePhones[0] || matchContact(name, "", phoneMap) || "";
    const biodata = extractBiodata(snippet);

    return {
        id: `linkedin_c_${index}_${Date.now()}`,
        name,
        industry,
        followers,
        email,
        phone,
        biodata,
        linkedinUrl: link,
        type: "company",
        source: "LINKEDIN",
        enquiryType: "SERVICES"
    };
};

// ─── Controllers ─────────────────────────────────────────────────────────────

const searchLinkedInLeads = async (req, res, next) => {
    try {
        const { query, type = "people", location = "" } = req.body;

        if (!query || !query.trim()) {
            return res.status(400).json({ message: "Search query is required" });
        }

        const apiKey = await getSerperKey();
        if (!apiKey) {
            throw new ApiError(503, "SERVICE_UNAVAILABLE", "Serper API key not configured. Add SERPER_API_KEY to .env or configure LinkedIn Lead Search in Settings → Integrations.");
        }

        const sitePrefix = type === "companies"
            ? "site:linkedin.com/company"
            : "site:linkedin.com/in";

        const locationPart = location.trim() ? ` "${location.trim()}"` : "";
        const linkedinQuery = `${sitePrefix} "${query.trim()}"${locationPart}`;
        const contactQuery = `"${query.trim()}"${locationPart} email contact phone`;

        const [linkedinRes, contactRes] = await Promise.allSettled([
            axios.post(
                `${SERPER_BASE_URL}/search`,
                { q: linkedinQuery, gl: "in", hl: "en", num: 20 },
                { headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" } }
            ),
            axios.post(
                `${SERPER_BASE_URL}/search`,
                { q: contactQuery, gl: "in", hl: "en", num: 20 },
                { headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" } }
            )
        ]);

        if (linkedinRes.status === "rejected") {
            const err = linkedinRes.reason;
            const msg = err.response?.data?.message || `Serper API error (${err.response?.status ?? "network"})`;
            throw new ApiError(502, "SERPER_ERROR", `Search API error: ${msg}`);
        }

        const organic = linkedinRes.value.data.organic || [];
        const contactOrganic = contactRes.status === "fulfilled" ? contactRes.value.data.organic || [] : [];
        const { emailMap, phoneMap } = buildContactMaps(contactOrganic);

        const urlPattern = type === "companies"
            ? /linkedin\.com\/company\//i
            : /linkedin\.com\/in\//i;

        const leads = organic
            .filter((r) => urlPattern.test(r.link || ""))
            .map((r, i) =>
                type === "companies"
                    ? parseCompanyResult(r, i, emailMap, phoneMap)
                    : parsePersonResult(r, i, emailMap, phoneMap)
            )
            .filter((r) => r.name && r.name !== "Unknown");

        res.json({ leads, total: leads.length, query: query.trim(), type });
    } catch (error) {
        if (error.response) {
            // Serper API returned an error — surface the actual message
            const msg = error.response.data?.message || error.response.data?.error || `Serper API error (${error.response.status})`;
            return next(new ApiError(502, "SERPER_ERROR", `Search API error: ${msg}`));
        }
        return next(error);
    }
};

const importLinkedInLeads = async (req, res, next) => {
    try {
        const { userId } = req.user;
        const { leads } = req.body;

        if (!leads || !Array.isArray(leads) || leads.length === 0) {
            return res.status(400).json({ message: "No leads provided" });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { workspaceId: true }
        });

        let created = 0;
        let duplicates = 0;
        const createdLeads = [];

        for (const leadData of leads) {
            const {
                name,
                email,
                phone,
                jobTitle,
                company,
                biodata,
                linkedinUrl,
                enquiryType = "SERVICES"
            } = leadData;

            if (!name) continue;

            // Deduplicate: by LinkedIn URL, or by phone/email if present
            const orConditions = [];
            if (linkedinUrl) orConditions.push({ linkedinUrl });
            if (phone) orConditions.push({ phone });
            if (email) orConditions.push({ email });

            if (orConditions.length > 0) {
                const existing = await prisma.lead.findFirst({ where: { OR: orConditions } });
                if (existing) {
                    duplicates++;
                    continue;
                }
            }

            const { score, category } = calculateLeadScore({
                source: "LINKEDIN",
                phone: phone || null,
                email: email || null
            });

            const newLead = await prisma.lead.create({
                data: {
                    name,
                    email: email || null,
                    phone: phone || null,
                    source: "LINKEDIN",
                    enquiryType,
                    score,
                    category,
                    isSearchLead: true,
                    linkedinUrl: linkedinUrl || null,
                    jobTitle: jobTitle || null,
                    company: company || null,
                    biodata: biodata || null,
                    assignedToId: userId,
                    workspaceId: user?.workspaceId || null
                }
            });

            await logActivity({
                leadId: newLead.id,
                userId,
                action: "LEAD_CREATED",
                metadata: { source: "LINKEDIN_SEARCH", score, category, linkedinUrl }
            });

            createdLeads.push(newLead);
            created++;
        }

        res.json({
            message: `${created} lead${created !== 1 ? "s" : ""} imported successfully.${
                duplicates > 0
                    ? ` ${duplicates} duplicate${duplicates !== 1 ? "s" : ""} skipped.`
                    : ""
            }`,
            created,
            duplicates,
            leads: createdLeads
        });
    } catch (error) {

        return next(error);
    }
};

module.exports = { searchLinkedInLeads, importLinkedInLeads };
