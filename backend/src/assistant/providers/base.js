class LLMProvider {
    async chat({ systemPrompt, messages, tools, maxTokens }) {
        throw new Error("chat() not implemented");
    }

    normalizeError(err) {
        throw new Error("normalizeError() not implemented");
    }
}

module.exports = LLMProvider;
