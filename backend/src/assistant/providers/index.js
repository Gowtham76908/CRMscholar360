const getProvider = () => {
    const name = (process.env.LLM_PROVIDER || "openai").toLowerCase();
    switch (name) {
        case "openai": return new (require("./openai"))();
        // case "anthropic": return new (require("./anthropic"))();
        // case "gemini":    return new (require("./gemini"))();
        default: throw new Error(`Unknown LLM_PROVIDER: "${name}". Valid: openai`);
    }
};

module.exports = { getProvider };
