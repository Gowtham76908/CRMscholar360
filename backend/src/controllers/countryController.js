const prisma = require("../utils/prisma");
const { ApiError, ERROR_CODES } = require("../utils/apiError");

const listCountries = async (req, res, next) => {
    try {
        const countries = await prisma.country.findMany({
            include: {
                universities: {
                    orderBy: { name: "asc" }
                }
            },
            orderBy: { name: "asc" }
        });
        res.json(countries);
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

        // Check if country exists
        const country = await prisma.country.findUnique({
            where: { id: countryId }
        });
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
                countryId
            }
        });
        if (existing) {
            return res.status(200).json(existing); // Return existing instead of failing
        }

        const university = await prisma.university.create({
            data: {
                name: formattedName,
                countryId
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
