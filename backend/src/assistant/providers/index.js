// Lazy singleton per process — the OpenAI client keeps its own HTTPS pool
// and re-instantiating per request defeats that.
let _instance = null;

const getProvider = () => {
    if (_instance) return _instance;
    const name = (process.env.LLM_PROVIDER || "openai").toLowerCase();
    switch (name) {
        case "openai": _instance = new (require("./openai"))(); break;
        // case "anthropic": _instance = new (require("./anthropic"))(); break;
        // case "gemini":    _instance = new (require("./gemini"))();    break;
        default: throw new Error(`Unknown LLM_PROVIDER: "${name}". Valid: openai`);
    }
    return _instance;
};

module.exports = { getProvider };
