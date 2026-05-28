const crypto                              = require("crypto");
const prisma                              = require("../utils/prisma");
const { getProvider }                     = require("./providers");
const { buildSystemPrompt }                = require("./prompts/system");
const { getToolDefinitions, executeTool } = require("./toolRegistry");
const { getAllowedToolNames, isToolAllowed, auditLog } = require("./permissionGuard");
const { getSession, addTurn }             = require("./contextManager");
const logger                              = require("../utils/logger");

const MAX_ITERATIONS       = 5;  // distinct LLM round-trips per request
const MAX_TOTAL_TOOL_CALLS = 10; // sum of all tool calls across iterations

const handleChat = async ({ userId, userName, role, message, currentPage }) => {
    const requestId = crypto.randomUUID().slice(0, 8);
    const provider  = getProvider();

    // Phase 4: load conversation history from contextManager
    const history = getSession(userId);

    // Phase 5: resolve user name (one cheap indexed read) so the LLM can address them
    let resolvedUserName = userName;
    if (!resolvedUserName && userId) {
        try {
            const user = await prisma.user.findUnique({
                where:  { id: userId },
                select: { name: true },
            });
            resolvedUserName = user?.name ?? null;
        } catch (err) {
            logger.warn({ requestId, userId, err: err.message }, "Failed to load userName for system prompt");
        }
    }

    const systemPrompt = buildSystemPrompt({ userName: resolvedUserName, role, currentPage });

    // Phase 3: filter tools by role — the LLM never sees forbidden tools
    const allowedNames = getAllowedToolNames(role);
    const tools        = getToolDefinitions(allowedNames);

    logger.info(
        { requestId, userId, role, allowedTools: allowedNames.length, msgLen: message.length, historyMessages: history.length },
        "Assistant request start",
    );

    const messages       = [...history, { role: "user", content: message }];
    let   usage          = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let   toolCallsTotal = 0;

    for (let iter = 1; iter <= MAX_ITERATIONS; iter++) {
        let result;
        try {
            result = await provider.chat({ systemPrompt, messages, tools, maxTokens: 1024, requestId });
        } catch (err) {
            const normalized = provider.normalizeError(err);
            logger.error({ requestId, userId, errorType: normalized.type, err: err.message }, "Assistant provider error");
            const wrapped = new Error(normalized.message);
            wrapped.assistantError = normalized.type;
            throw wrapped;
        }

        // Accumulate token usage across all LLM calls in this turn
        usage = {
            promptTokens:     usage.promptTokens     + (result.usage?.promptTokens     || 0),
            completionTokens: usage.completionTokens + (result.usage?.completionTokens || 0),
            totalTokens:      usage.totalTokens      + (result.usage?.totalTokens      || 0),
        };

        // Final answer — no tool calls left to resolve
        if (!result.toolCalls || result.toolCalls.length === 0) {
            const finalReply = result.reply ?? "";
            // Only persist successful turns. Cap/iteration fallback replies are skipped
            // below so future LLM calls don't see "I couldn't answer that" as context.
            if (finalReply) {
                addTurn(userId, { userMessage: message, assistantMessage: finalReply });
            }
            logger.info(
                { requestId, userId, iter, toolCallsTotal, totalTokens: usage.totalTokens, persisted: Boolean(finalReply) },
                "Assistant turn complete",
            );
            return { reply: finalReply, usage, requestId };
        }

        // Enforce total tool-call cap (in addition to iteration cap)
        toolCallsTotal += result.toolCalls.length;
        if (toolCallsTotal > MAX_TOTAL_TOOL_CALLS) {
            logger.warn(
                { requestId, userId, toolCallsTotal, cap: MAX_TOTAL_TOOL_CALLS },
                "Assistant exceeded total tool-call cap",
            );
            return {
                reply: "I had to make too many lookups for that question. Try something more focused.",
                usage,
                requestId,
            };
        }

        // Record the assistant's tool-call turn
        messages.push({
            role:      "assistant",
            content:   result.reply,
            toolCalls: result.toolCalls,
        });

        // Resolve every tool call in parallel; each becomes its own tool message.
        // Permission check is defense-in-depth — forbidden tools weren't sent to the LLM,
        // so a hit here means either prompt-injection or a registry bug; either way we audit.
        const toolResults = await Promise.all(result.toolCalls.map(async tc => {
            const allowed = isToolAllowed(role, tc.name);
            auditLog({ requestId, userId, role, tool: tc.name, allowed, args: tc.arguments });

            if (!allowed) {
                return {
                    id: tc.id,
                    content: JSON.stringify({ error: "PERMISSION_DENIED", message: `Tool ${tc.name} not allowed for role ${role}.` }),
                };
            }

            const t0 = Date.now();
            try {
                const data = await executeTool(tc.name, tc.arguments, { userId, role, requestId });
                logger.info({ requestId, userId, tool: tc.name, latencyMs: Date.now() - t0 }, "Tool executed");
                return { id: tc.id, content: JSON.stringify(data) };
            } catch (err) {
                logger.warn({ requestId, userId, tool: tc.name, err: err.message }, "Tool execution failed");
                return { id: tc.id, content: JSON.stringify({ error: "TOOL_ERROR", message: err.message }) };
            }
        }));

        for (const tr of toolResults) {
            messages.push({ role: "tool", toolCallId: tr.id, content: tr.content });
        }
    }

    logger.warn(
        { requestId, userId, maxIter: MAX_ITERATIONS, toolCallsTotal },
        "Assistant tool-call loop reached max iterations",
    );
    return {
        reply: "I needed too many steps to answer that. Could you ask something more specific?",
        usage,
        requestId,
    };
};

module.exports = { handleChat };
