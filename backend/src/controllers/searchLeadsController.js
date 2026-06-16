const axios = require("axios");
const prisma = require("../utils/prisma");
const leadService = require("../services/leadService");
const calculateLeadScore = require("../utils/leadScorer");
const logActivity = require("../utils/activityLogger");
const { ApiError } = require("../utils/apiError");
const { getSerperKey } = require("../utils/serperKey");

const SERPER_BASE_URL = "https://google.serper.dev";

// Extract emails from text using regex
const extractEmails = (text) => {
    if (!text) return [];
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return text.match(emailRegex) || [];
};

// Search businesses via Serper API (places + web)
const searchBusinessLeads = async (req, res, next) => {
    try {
        const { query } = req.body;

        if (!query || !query.trim()) {
            return res.status(400).json({ message: "Search query is required" });
        }

        const apiKey = await getSerperKey();
        if (!apiKey) {
            throw new ApiError(503, "SERVICE_UNAVAILABLE", "Serper API key not configured. Add SERPER_API_KEY to .env or configure LinkedIn Lead Search in Settings → Integrations.");
        }

        // 1. Places search — gives phone, address, website
        const placesResponse = await axios.post(
            `${SERPER_BASE_URL}/places`,
            { q: query.trim(), gl: "in", hl: "en" },
            {
                headers: {
                    "X-API-KEY": apiKey,
                    "Content-Type": "application/json"
                }
            }
        );

        // 2. Web search — helps us find email addresses
        const webResponse = await axios.post(
            `${SERPER_BASE_URL}/search`,
            { q: `${query.trim()} email contact`, gl: "in", hl: "en", num: 20 },
            {
                headers: {
                    "X-API-KEY": apiKey,
                    "Content-Type": "application/json"
                }
            }
        );

        const places = placesResponse.data.places || [];
        const organic = webResponse.data.organic || [];
        const knowledgeGraph = webResponse.data.knowledgeGraph || null;

        // Build a map of company name → emails found in web results
        const emailMap = {};
        organic.forEach((result) => {
            const emails = [
                ...extractEmails(result.snippet || ""),
                ...extractEmails(result.title || "")
            ];
            if (emails.length > 0) {
                const titleWords = (result.title || "").toLowerCase().split(/\s+/);
                titleWords.forEach((word) => {
                    if (word.length > 3) {
                        emailMap[word] = emailMap[word] || emails[0];
                    }
                });
            }
        });

        // Also try knowledge graph email
        const kgEmail = knowledgeGraph
            ? extractEmails(JSON.stringify(knowledgeGraph))[0] || null
            : null;

        // Map places to lead candidates
        const leads = places.map((place, index) => {
            // Try to find an email by matching company name words
            const nameWords = (place.title || "").toLowerCase().split(/\s+/);
            let email = null;
            for (const word of nameWords) {
                if (emailMap[word]) {
                    email = emailMap[word];
                    break;
                }
            }
            // Use knowledge graph email if single top result
            if (!email && index === 0 && kgEmail) email = kgEmail;

            return {
                id: `serper_${index}_${Date.now()}`,
                name: place.title || "Unknown Company",
                phone: place.phoneNumber || "",
                email: email || "",
                address: place.address || "",
                website: place.website || "",
                rating: place.rating || null,
                ratingCount: place.ratingCount || null,
                category: place.category || "",
                source: "WEBSITE",
                enquiryType: "SERVICES"
            };
        });

        res.json({ leads, total: leads.length, query: query.trim() });
    } catch (error) {
        if (error.response) {
            // Serper API returned an error (bad key, rate limit, etc.) — surface it
            const msg = error.response.data?.message || error.response.data?.error || `Serper API error (${error.response.status})`;
            return next(new ApiError(502, "SERPER_ERROR", `Search API error: ${msg}`));
        }
        return next(error);
    }
};

// Bulk import searched leads into the database
const importSearchedLeads = async (req, res, next) => {
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
                phone,
                email,
                source = "WEBSITE",
                enquiryType = "SERVICES"
            } = leadData;

            if (!name || !phone) continue;

            // Duplicate check by phone or email
            const orConditions = [{ phone }];
            if (email) orConditions.push({ email });

            const existing = await prisma.lead.findFirst({
                where: { OR: orConditions }
            });

            if (existing) {
                duplicates++;
                continue;
            }

            const { score, category } = calculateLeadScore({ source, phone, email });

            // Centralized creation: Lead + SALES LeadDepartment, claimed by the searcher.
            const newLead = await leadService.createLead(
                {
                    name,
                    email: email || null,
                    phone,
                    source,
                    enquiryType,
                    score,
                    category,
                    isSearchLead: true,
                    workspaceId: user?.workspaceId || null
                },
                { salesAssigneeId: userId }
            );

            await logActivity({
                leadId: newLead.id,
                userId,
                action: "LEAD_CREATED",
                metadata: { source: "SERPER_SEARCH", score, category }
            });

            createdLeads.push(newLead);
            created++;
        }

        res.json({
            message: `${created} lead${created !== 1 ? "s" : ""} imported successfully.${duplicates > 0 ? ` ${duplicates} duplicate${duplicates !== 1 ? "s" : ""} skipped.` : ""}`,
            created,
            duplicates,
            leads: createdLeads
        });
    } catch (error) {

        return next(error);
    }
};

module.exports = { searchBusinessLeads, importSearchedLeads };
