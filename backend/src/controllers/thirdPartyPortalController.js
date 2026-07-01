const prisma = require("../utils/prisma");
const { ApiError, ERROR_CODES } = require("../utils/apiError");

const listPortals = async (req, res, next) => {
    try {
        const portals = await prisma.thirdPartyPortal.findMany({
            orderBy: { name: "asc" }
        });
        res.json(portals);
    } catch (error) {
        next(error);
    }
};

const toTitleCase = (str) => {
    return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
};

const createPortal = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Portal name is required");
        }

        const formattedName = name.trim(); // keep exact case or TitleCase, TitleCase is good
        const displayName = toTitleCase(formattedName);

        // Check if portal already exists case-insensitively
        const existing = await prisma.thirdPartyPortal.findFirst({
            where: {
                name: {
                    equals: displayName,
                    mode: "insensitive"
                }
            }
        });
        if (existing) {
            return res.status(200).json(existing); // Return existing instead of failing
        }

        const portal = await prisma.thirdPartyPortal.create({
            data: { name: displayName }
        });

        res.status(201).json(portal);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    listPortals,
    createPortal
};
