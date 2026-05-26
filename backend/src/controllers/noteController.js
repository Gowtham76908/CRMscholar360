const prisma = require("../utils/prisma");

// Create Note
const createNote = async (req, res, next) => {
    try {
        const { leadId } = req.params;
        const { content } = req.body;

        // Verify lead exists
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) {
            throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Lead not found");
        }

        const note = await prisma.note.create({
            data: {
                leadId,
                content
            }
        });

        res.status(201).json({ message: "Note added successfully", note });
    } catch (error) {
        return next(error);
    }
};

// Get Notes for a Lead
const getNotes = async (req, res, next) => {
    try {
        const { leadId } = req.params;

        const notes = await prisma.note.findMany({
            where: { leadId },
            orderBy: { createdAt: "desc" }
        });

        res.json(notes);
    } catch (error) {
        return next(error);
    }
};

module.exports = {
    createNote,
    getNotes
};
