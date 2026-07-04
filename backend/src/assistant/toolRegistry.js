const leadTools       = require("./tools/leadTools");
const taskTools       = require("./tools/taskTools");
const revenueTools    = require("./tools/revenueTools");
const attendanceTools = require("./tools/attendanceTools");

const ALL_TOOLS = {
    ...leadTools,
    ...taskTools,
    ...revenueTools,
    ...attendanceTools,
};

const getToolDefinitions = (names) => {
    const keys = (names && names.length) ? names : Object.keys(ALL_TOOLS);
    return keys
        .map(n => ALL_TOOLS[n])
        .filter(Boolean)
        .map(t => ({ name: t.name, description: t.description, parameters: t.parameters }));
};

const executeTool = async (name, args, ctx) => {
    const tool = ALL_TOOLS[name];
    if (!tool) throw new Error(`Tool not found: ${name}`);
    return tool.execute(args ?? {}, ctx);
};

module.exports = { getToolDefinitions, executeTool };
