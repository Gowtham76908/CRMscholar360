const OpenAI      = require("openai");
const LLMProvider = require("./base");
const logger      = require("../../utils/logger");

const TIMEOUT_MS  = 15_000;
const MAX_RETRIES = 2;

class OpenAIProvider extends LLMProvider {
    constructor() {
        super();
        this._client = new OpenAI({
            apiKey:     process.env.OPENAI_API_KEY,
            maxRetries: 0, // we handle retries ourselves for structured logging
        });
    }

    async chat({ systemPrompt, messages, tools = [], maxTokens = 1024, requestId }) {
        const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

        // Build OpenAI message array from normalized internal format
        const oaiMessages = [];
        if (systemPrompt) oaiMessages.push({ role: "system", content: systemPrompt });

        for (const m of messages) {
            if (m.role === "tool") {
                // Tool result turn: { role:"tool", toolCallId, content }
                oaiMessages.push({ role: "tool", tool_call_id: m.toolCallId, content: m.content });
            } else if (m.role === "assistant" && m.toolCalls?.length) {
                // Assistant turn that triggered tool calls
                oaiMessages.push({
                    role:       "assistant",
                    content:    m.content ?? null,
                    tool_calls: m.toolCalls.map(tc => ({
                        id:       tc.id,
                        type:     "function",
                        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
                    })),
                });
            } else {
                oaiMessages.push({ role: m.role, content: m.content });
            }
        }

        // Convert tool definitions to OpenAI function-calling format
        const oaiTools = tools.length
            ? tools.map(t => ({
                type:     "function",
                function: { name: t.name, description: t.description, parameters: t.parameters },
              }))
            : undefined;

        let attempt = 0;
        while (true) {
            const controller = new AbortController();
            const timeoutId  = setTimeout(() => controller.abort(), TIMEOUT_MS);
            const t0         = Date.now();

            try {
                const resp = await this._client.chat.completions.create(
                    {
                        model,
                        messages:    oaiMessages,
                        tools:       oaiTools,
                        tool_choice: oaiTools ? "auto" : undefined,
                        max_tokens:  maxTokens,
                    },
                    { signal: controller.signal },
                );
                clearTimeout(timeoutId);

                const latencyMs = Date.now() - t0;
                const usage     = resp.usage ?? {};
                logger.info({
                    requestId,
                    provider:         "openai",
                    model,
                    latencyMs,
                    promptTokens:     usage.prompt_tokens,
                    completionTokens: usage.completion_tokens,
                    totalTokens:      usage.total_tokens,
                }, "LLM call complete");

                const msg = resp.choices[0].message;

                const toolCalls = (msg.tool_calls ?? []).map(tc => ({
                    id:        tc.id,
                    name:      tc.function.name,
                    arguments: JSON.parse(tc.function.arguments || "{}"),
                }));

                return {
                    reply:     msg.content ?? null,
                    toolCalls,
                    usage: {
                        promptTokens:     usage.prompt_tokens     ?? 0,
                        completionTokens: usage.completion_tokens ?? 0,
                        totalTokens:      usage.total_tokens      ?? 0,
                    },
                };
            } catch (err) {
                clearTimeout(timeoutId);
                if (attempt < MAX_RETRIES && this._isRetryable(err)) {
                    const delayMs = Math.pow(2, attempt) * 1000; // 1 s → 2 s
                    logger.warn({ requestId, attempt, delayMs, err: err.message }, "LLM call failed, retrying");
                    await new Promise(r => setTimeout(r, delayMs));
                    attempt++;
                    continue;
                }
                throw err;
            }
        }
    }

    _isRetryable(err) {
        if (err.name === "AbortError") return false; // timeout — don't pile up retries
        if (err.status >= 500)         return true;
        if (!err.status)               return true;  // network error
        return false;
    }

    normalizeError(err) {
        if (err.name === "AbortError") return { type: "TIMEOUT",       message: "AI request timed out" };
        if (err.status === 429)        return { type: "RATE_LIMITED",  message: "AI rate limit reached" };
        if (err.status >= 500)         return { type: "PROVIDER_DOWN", message: "AI provider unavailable" };
        return                                { type: "UNKNOWN",       message: err.message };
    }
}

module.exports = OpenAIProvider;
