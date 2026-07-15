const prisma = require("../utils/prisma");
const { ApiError, ERROR_CODES } = require("../utils/apiError");

const listCountries = async (req, res, next) => {
    try {
        const dbCountries = await prisma.country.findMany({
            include: {
                universities: {
                    orderBy: { name: "asc" }
                }
            },
            orderBy: { name: "asc" }
        });

        const leads = await prisma.lead.findMany({
            where: { mergedIntoId: null },
            select: { customFields: true }
        });

        const counts = {};
        leads.forEach(l => {
            const dest = l.customFields?.destinationCountries;
            if (dest && typeof dest === "string") {
                const list = dest.split(",").map(c => c.trim()).filter(Boolean);
                const uniqueList = Array.from(new Set(list));
                uniqueList.forEach(c => {
                    counts[c] = (counts[c] || 0) + 1;
                });
            }
        });

        const countryMap = new Map();

        // 1. Initialize map with default country options available when creating a lead
        const DEFAULT_COUNTRIES = [
            "United Kingdom",
            "United States",
            "USA",
            "Canada",
            "Australia",
            "Ireland",
            "Germany"
        ];
        DEFAULT_COUNTRIES.forEach(name => {
            countryMap.set(name.toLowerCase(), {
                id: `default-${name.toLowerCase()}`,
                name: name,
                universities: [],
                count: 0
            });
        });

        // 2. Overwrite/merge database countries (which might contain universities)
        dbCountries.forEach(c => {
            countryMap.set(c.name.toLowerCase(), {
                id: c.id,
                name: c.name,
                universities: c.universities,
                count: 0
            });
        });

        // 3. Add counts and discover any custom countries on leads
        Object.keys(counts).forEach(cName => {
            const lower = cName.toLowerCase();
            if (countryMap.has(lower)) {
                countryMap.get(lower).count = counts[cName];
            } else {
                countryMap.set(lower, {
                    id: `extra-${lower}`,
                    name: cName,
                    universities: [],
                    count: counts[cName]
                });
            }
        });

        const result = Array.from(countryMap.values()).sort((a, b) => {
            if (b.count !== a.count) {
                return b.count - a.count;
            }
            return a.name.localeCompare(b.name);
        });
        res.json(result);
    } catch (error) {
        next(error);
    }
};

const toTitleCase = (str) => {
    return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
};

const createCountry = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Country name is required");
        }

        const formattedName = toTitleCase(name.trim());

        // Check if country already exists case-insensitively
        const existing = await prisma.country.findFirst({
            where: {
                name: {
                    equals: formattedName,
                    mode: "insensitive"
                }
            }
        });
        if (existing) {
            return res.status(200).json(existing); // Return existing instead of failing
        }

        const country = await prisma.country.create({
            data: { name: formattedName }
        });

        res.status(201).json(country);
    } catch (error) {
        next(error);
    }
};

const createUniversity = async (req, res, next) => {
    try {
        const { countryId } = req.params;
        const { name } = req.body;

        if (!name || !name.trim()) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "University name is required");
        }

        const formattedName = toTitleCase(name.trim());

        let country;
        let resolvedCountryId = countryId;

        if (countryId.startsWith("default-") || countryId.startsWith("extra-")) {
            // It's a virtual country option. Let's create it in the database if it doesn't exist.
            const rawName = countryId.replace(/^(default-|extra-)/, "").replace(/-/g, " ");
            // Special mapping for common abbreviations
            let countryName = toTitleCase(rawName);
            if (countryName.toLowerCase() === "usa") countryName = "USA";
            if (countryName.toLowerCase() === "uk") countryName = "UK";
            if (countryName.toLowerCase() === "uae") countryName = "UAE";

            country = await prisma.country.findFirst({
                where: { name: { equals: countryName, mode: "insensitive" } }
            });

            if (!country) {
                country = await prisma.country.create({
                    data: { name: countryName }
                });
            }
            resolvedCountryId = country.id;
        } else {
            country = await prisma.country.findUnique({
                where: { id: countryId }
            });
        }

        if (!country) {
            throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Country not found");
        }

        // Check unique constraint for name + countryId case-insensitively
        const existing = await prisma.university.findFirst({
            where: {
                name: {
                    equals: formattedName,
                    mode: "insensitive"
                },
                countryId: resolvedCountryId
            }
        });
        if (existing) {
            return res.status(200).json(existing); // Return existing instead of failing
        }

        const university = await prisma.university.create({
            data: {
                name: formattedName,
                countryId: resolvedCountryId
            }
        });

        res.status(201).json(university);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    listCountries,
    createCountry,
    createUniversity
};
