const prisma = require("../utils/prisma");

// Create Note
const createNote = async (req, res) => {
    try {
        const { leadId } = req.params;
        const { content } = req.body;

        // Verify lead exists
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
        }

        const note = await prisma.note.create({
            data: {
                leadId,
                content
            }
        });

        res.status(201).json({ message: "Note added successfully", note });
    } catch (error) {
        res.status(500).json({ message: "Error adding note", error: error.message });
    }
};

// Get Notes for a Lead
const getNotes = async (req, res) => {
    try {
        const { leadId } = req.params;

        const notes = await prisma.note.findMany({
            where: { leadId },
            orderBy: { createdAt: "desc" }
        });

        res.json(notes);
    } catch (error) {
        res.status(500).json({ message: "Error fetching notes", error: error.message });
    }
};

module.exports = {
    createNote,
    getNotes
};
