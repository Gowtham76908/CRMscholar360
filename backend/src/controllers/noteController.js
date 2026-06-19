const prisma = require("../utils/prisma");
const { ApiError, ERROR_CODES } = require("../utils/apiError");
const { canAccessLead } = require("../services/permissionService");

// Create Note
const createNote = async (req, res, next) => {
    try {
        const { leadId } = req.params;
        const { content } = req.body;

        if (!content || typeof content !== "string" || !content.trim()) {
            throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Note content is required");
        }

        // Verify lead exists and the requester is allowed to see it — notes are
        // customer interaction history, scoped the same way leads are.
        const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
        if (!lead) {
            throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Lead not found");
        }
        if (!(await canAccessLead(req.user.userId, req.user.role, lead))) {
            throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "Access denied");
        }

        const note = await prisma.note.create({
            data: {
                leadId,
                userId: req.user.userId,
                content: content.trim()
            },
            include: {
                user: { select: { id: true, name: true, profilePhoto: true } }
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

        const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
        if (!lead) {
            throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Lead not found");
        }
        if (!(await canAccessLead(req.user.userId, req.user.role, lead))) {
            throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "Access denied");
        }

        const notes = await prisma.note.findMany({
            where: { leadId },
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { id: true, name: true, profilePhoto: true } }
            }
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
