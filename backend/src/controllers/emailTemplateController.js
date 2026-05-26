const prisma = require("../utils/prisma");
const { ApiError } = require("../utils/apiError");

const list = async (req, res, next) => {
    try {
        const templates = await prisma.emailTemplate.findMany({
            orderBy: { createdAt: "desc" },
            include: { createdBy: { select: { id: true, name: true } } },
        });
        res.json(templates);
    } catch (err) {
        return next(err);
    }
};

const create = async (req, res, next) => {
    const { name, subject, body } = req.body;
    if (!name || !subject || !body) {
        return res.status(400).json({ message: "name, subject, and body are required" });
    }
    try {
        const template = await prisma.emailTemplate.create({
            data: { name, subject, body, createdById: req.user.userId },
        });
        res.status(201).json(template);
    } catch (err) {
        return next(err);
    }
};

const update = async (req, res, next) => {
    const { id } = req.params;
    const { name, subject, body } = req.body;
    try {
        const template = await prisma.emailTemplate.findUnique({ where: { id } });
        if (!template) return res.status(404).json({ message: "Template not found" });

        const updated = await prisma.emailTemplate.update({
            where: { id },
            data: {
                ...(name    !== undefined && { name }),
                ...(subject !== undefined && { subject }),
                ...(body    !== undefined && { body }),
            },
        });
        res.json(updated);
    } catch (err) {
        return next(err);
    }
};

const remove = async (req, res, next) => {
    const { id } = req.params;
    try {
        await prisma.emailTemplate.delete({ where: { id } });
        res.json({ ok: true });
    } catch (err) {
        return next(err);
    }
};

module.exports = { list, create, update, remove };
