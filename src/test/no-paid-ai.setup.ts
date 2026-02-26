// Guardrail: test runs must never consume paid LLM tokens.
process.env.XAI_API_KEY = "";
process.env.OPENAI_API_KEY = "";
process.env.ANTHROPIC_API_KEY = "";
process.env.GOOGLE_GENERATIVE_AI_API_KEY = "";

// Force default runtime route away from external provider calls in tests.
process.env.AI_MODEL_PROVIDER = "mock";
process.env.AI_MODEL_NAME = "mock-test";
process.env.AI_MODEL_FALLBACK_PROVIDER = "";
process.env.AI_MODEL_FALLBACK_NAME = "";
