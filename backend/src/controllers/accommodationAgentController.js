const prisma = require("../utils/prisma");
const { ApiError, ERROR_CODES } = require("../utils/apiError");

const DEFAULT_AGENTS = [
    "AmberStudent", "Casita", "Student.com", "Airbnb", "Booking.com", 
    "Hostelworld", "Uniplaces", "MakeMyTrip", "EaseMyTrip", "Skyscanner",
    "Qatar Airways", "Emirates", "Air India", "IndiGo", "Direct Provider"
];

const listAgents = async (req, res, next) => {
    try {
        const dbAgents = await prisma.accommodationAgent.findMany({ orderBy: { name: "asc" } });

        // Merge curated defaults with DB agents, de-duped case-insensitively.
        const byLower = new Map();
        DEFAULT_AGENTS.forEach((name) => byLower.set(name.toLowerCase(), { id: `default-${name.toLowerCase()}`, name }));
        dbAgents.forEach((a) => byLower.set(a.name.toLowerCase(), { id: a.id, name: a.name }));

        const result = Array.from(byLower.values()).sort((a, b) => a.name.localeCompare(b.name));
        res.json(result);
    } catch (error) {
        next(error);
    }
};

const createAgent = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Agent/Company name is required");
        }

        const trimmed = name.trim();

        // Return existing row if it's already there (or a default).
        const existing = await prisma.accommodationAgent.findFirst({
            where: { name: { equals: trimmed, mode: "insensitive" } },
        });
        if (existing) return res.status(200).json(existing);

        const agent = await prisma.accommodationAgent.create({ data: { name: trimmed } });
        res.status(201).json(agent);
    } catch (error) {
        next(error);
    }
};

module.exports = { listAgents, createAgent };
