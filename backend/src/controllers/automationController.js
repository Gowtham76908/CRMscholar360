const prisma = require("../utils/prisma");

const ruleInclude = {
    conditions: true,
    actions: { orderBy: { order: "asc" } },
    _count: { select: { logs: true } }
};

// GET /api/automations
const getRules = async (req, res) => {
    try {
        const rules = await prisma.automationRule.findMany({
            include: ruleInclude,
            orderBy: { createdAt: "desc" }
        });
        res.json(rules);
    } catch (err) {
        res.status(500).json({ message: "Error fetching automation rules", error: err.message });
    }
};

// POST /api/automations
const createRule = async (req, res) => {
    try {
        const { name, description, triggerType, triggerConfig, conditions = [], actions = [] } = req.body;

        if (!name || !triggerType) {
            return res.status(400).json({ message: "name and triggerType are required" });
        }

        const rule = await prisma.automationRule.create({
            data: {
                name,
                description,
                triggerType,
                triggerConfig: triggerConfig ?? null,
                conditions: { create: conditions },
                actions: {
                    create: actions.map((a, i) => ({ ...a, order: i }))
                }
            },
            include: ruleInclude
        });

        res.status(201).json(rule);
    } catch (err) {
        res.status(500).json({ message: "Error creating rule", error: err.message });
    }
};

// PATCH /api/automations/:id
const updateRule = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, isActive, triggerType, triggerConfig, conditions, actions } = req.body;

        const existing = await prisma.automationRule.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: "Rule not found" });

        // Replace conditions and actions wholesale when provided
        const updateData = {
            ...(name        !== undefined && { name }),
            ...(description !== undefined && { description }),
            ...(isActive    !== undefined && { isActive }),
            ...(triggerType !== undefined && { triggerType }),
            ...(triggerConfig !== undefined && { triggerConfig }),
        };

        if (conditions !== undefined) {
            await prisma.automationCondition.deleteMany({ where: { ruleId: id } });
            updateData.conditions = { create: conditions };
        }

        if (actions !== undefined) {
            await prisma.automationAction.deleteMany({ where: { ruleId: id } });
            updateData.actions = { create: actions.map((a, i) => ({ ...a, order: i })) };
        }

        const updated = await prisma.automationRule.update({
            where: { id },
            data: updateData,
            include: ruleInclude
        });

        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: "Error updating rule", error: err.message });
    }
};

// DELETE /api/automations/:id
const deleteRule = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.automationRule.delete({ where: { id } });
        res.json({ message: "Rule deleted" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting rule", error: err.message });
    }
};

// PATCH /api/automations/:id/toggle
const toggleRule = async (req, res) => {
    try {
        const { id } = req.params;
        const rule = await prisma.automationRule.findUnique({ where: { id } });
        if (!rule) return res.status(404).json({ message: "Rule not found" });

        const updated = await prisma.automationRule.update({
            where: { id },
            data: { isActive: !rule.isActive },
            include: ruleInclude
        });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: "Error toggling rule", error: err.message });
    }
};

// GET /api/automations/:id/logs
const getRuleLogs = async (req, res) => {
    try {
        const { id } = req.params;
        const logs = await prisma.automationLog.findMany({
            where: { ruleId: id },
            include: { lead: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
            take: 50
        });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ message: "Error fetching logs", error: err.message });
    }
};

module.exports = { getRules, createRule, updateRule, deleteRule, toggleRule, getRuleLogs };
