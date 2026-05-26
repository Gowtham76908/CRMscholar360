const prisma = require("../utils/prisma");
const { seedDefaultAutomations } = require("../services/automationSeedService");
const { ApiError } = require("../utils/apiError");

const getRules = async (req, res, next) => {
    try {
        const rules = await prisma.automationRule.findMany({
            include: {
                conditions: true,
                actions: { orderBy: { order: "asc" } },
                _count: { select: { logs: true } },
            },
            orderBy: { createdAt: "asc" },
        });
        res.json(rules);
    } catch (e) {
        return next(e);
    }
};

const createRule = async (req, res, next) => {
    try {
        const { name, description, triggerType, triggerConfig, conditions = [], actions = [] } = req.body;
        if (!name || !triggerType) return res.status(400).json({ message: "name and triggerType are required" });

        const rule = await prisma.automationRule.create({
            data: {
                name,
                description,
                triggerType,
                triggerConfig: triggerConfig ?? {},
                isActive: true,
                conditions: { create: conditions },
                actions: { create: actions.map((a, i) => ({ type: a.type, config: a.config, order: a.order ?? i })) },
            },
            include: { conditions: true, actions: { orderBy: { order: "asc" } } },
        });
        res.status(201).json(rule);
    } catch (e) {
        return next(e);
    }
};

const toggleRule = async (req, res, next) => {
    try {
        const { id } = req.params;
        const current = await prisma.automationRule.findUnique({ where: { id }, select: { isActive: true } });
        if (!current) return res.status(404).json({ message: "Rule not found" });
        const rule = await prisma.automationRule.update({
            where: { id },
            data: { isActive: !current.isActive },
        });
        res.json(rule);
    } catch (e) {
        return next(e);
    }
};

const updateRule = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, triggerConfig, isActive, actions } = req.body;

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (triggerConfig !== undefined) updates.triggerConfig = triggerConfig;
        if (isActive !== undefined) updates.isActive = Boolean(isActive);

        if (actions !== undefined) {
            await prisma.automationAction.deleteMany({ where: { ruleId: id } });
            updates.actions = {
                create: actions.map((a, i) => ({ type: a.type, config: a.config, order: a.order ?? i })),
            };
        }

        const rule = await prisma.automationRule.update({
            where: { id },
            data: updates,
            include: { conditions: true, actions: { orderBy: { order: "asc" } } },
        });
        res.json(rule);
    } catch (e) {
        if (e.code === "P2025") return next(e);
        return next(e);
    }
};

const deleteRule = async (req, res, next) => {
    try {
        await prisma.automationRule.delete({ where: { id: req.params.id } });
        res.json({ deleted: true });
    } catch (e) {
        if (e.code === "P2025") return next(e);
        return next(e);
    }
};

const getRuleLogs = async (req, res, next) => {
    try {
        const logs = await prisma.automationLog.findMany({
            where: { ruleId: req.params.id },
            include: { lead: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
            take: 50,
        });
        res.json(logs);
    } catch (e) {
        return next(e);
    }
};

const seedRules = async (req, res, next) => {
    try {
        const results = await seedDefaultAutomations();
        res.json({ seeded: results });
    } catch (e) {
        return next(e);
    }
};

module.exports = { getRules, createRule, toggleRule, updateRule, deleteRule, getRuleLogs, seedRules };
