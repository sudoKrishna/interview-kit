import "dotenv/config";

export const config = {
  mongoUri: process.env.MONGODB_URI ?? "mongodb://localhost:27017/interview-prep-kit",
  sessionSecret: process.env.SESSION_SECRET ?? "dev-secret-do-not-use-in-prod",
  clientOrigin: (process.env.CLIENT_ORIGIN ?? "http://localhost:3000").split(",").map((s) => s.trim()),
  port: Number(process.env.PORT ?? 4000),

  llm: {
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.deepseek.com/v1",
    apiKey: process.env.LLM_API_KEY ?? "",
    model: process.env.LLM_MODEL ?? "deepseek-chat",
    maxRetries: Number(process.env.LLM_MAX_RETRIES ?? 4),
  },

  pipeline: {
    maxCoveragePasses: Number(process.env.MAX_COVERAGE_PASSES ?? 3),
    crawlMaxPages: Number(process.env.CRAWL_MAX_PAGES ?? 6),
    allowPrivateUrls: process.env.ALLOW_PRIVATE_URLS !== "false",
  },

  isProd: process.env.NODE_ENV === "production",
} as const;
