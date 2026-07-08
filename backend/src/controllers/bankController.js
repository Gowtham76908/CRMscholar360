const prisma = require("../utils/prisma");
const { ApiError, ERROR_CODES } = require("../utils/apiError");

// Curated defaults always offered in the bank dropdown, even before anything is
// saved. DB rows (custom banks a consultant added) are merged on top so they show
// as normal options thereafter.
const DEFAULT_BANKS = [
    "State Bank of India (SBI)",
    "HDFC Credila",
    "Axis Bank",
    "ICICI Bank",
    "Punjab National Bank (PNB)",
    "Bank of Baroda",
    "Canara Bank",
    "Union Bank of India",
    "IDBI Bank",
    "Avanse Financial Services",
    "Auxilo",
    "InCred",
    "Prodigy Finance",
    "Leap Finance",
];

const listBanks = async (req, res, next) => {
    try {
        const dbBanks = await prisma.bank.findMany({ orderBy: { name: "asc" } });

        // Merge curated defaults with DB banks, de-duped case-insensitively.
        const byLower = new Map();
        DEFAULT_BANKS.forEach((name) => byLower.set(name.toLowerCase(), { id: `default-${name.toLowerCase()}`, name }));
        dbBanks.forEach((b) => byLower.set(b.name.toLowerCase(), { id: b.id, name: b.name }));

        const result = Array.from(byLower.values()).sort((a, b) => a.name.localeCompare(b.name));
        res.json(result);
    } catch (error) {
        next(error);
    }
};

const createBank = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Bank name is required");
        }

        const trimmed = name.trim();

        // Return the existing row instead of failing if it's already there (or a default).
        const existing = await prisma.bank.findFirst({
            where: { name: { equals: trimmed, mode: "insensitive" } },
        });
        if (existing) return res.status(200).json(existing);

        const bank = await prisma.bank.create({ data: { name: trimmed } });
        res.status(201).json(bank);
    } catch (error) {
        next(error);
    }
};

module.exports = { listBanks, createBank };
