import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";

/**
 * Loads `.env` from the current directory or the nearest ancestor that has one.
 * Turbo runs each workspace script with cwd set to the package directory, so we
 * walk up to find the repository-root `.env`.
 */
export function loadEnv(startDir: string = process.cwd()): void {
  let dir = resolve(startDir);
  for (let i = 0; i < 6; i += 1) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  dotenv.config();
}

export type LlmProvider = "groq" | "openai-compatible" | "mock";

export interface LlmConfig {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
  maxConcurrency: number;
  maxRetries: number;
  maxOutputTokens: number;
}

export interface RetrievalConfig {
  timeoutMs: number;
  maxBytes: number;
  maxPages: number;
  concurrency: number;
  allowPrivateHosts: boolean;
  userAgent: string;
}

export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  webOrigins: string[];
  mongodbUri: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  sessionCookieName: string;
  llm: LlmConfig;
  retrieval: RetrievalConfig;
}

function readInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

function readBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function readList(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? "development";
  const provider = (env.LLM_PROVIDER ?? "mock").toLowerCase() as LlmProvider;

  return {
    nodeEnv,
    isProduction: nodeEnv === "production",
    port: readInt(env.PORT, 4000),
    webOrigins: readList(env.WEB_ORIGIN, ["http://localhost:3000"]),
    mongodbUri: env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/interview-prep-kit",
    jwtSecret: env.JWT_SECRET ?? "insecure-development-secret-change-me",
    jwtExpiresIn: env.JWT_EXPIRES_IN ?? "7d",
    sessionCookieName: env.SESSION_COOKIE_NAME ?? "ipk_session",
    llm: {
      provider,
      apiKey: env.LLM_API_KEY ?? "",
      model: env.LLM_MODEL ?? "llama-3.3-70b-versatile",
      baseUrl: (env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1").replace(/\/+$/, ""),
      maxConcurrency: readInt(env.LLM_MAX_CONCURRENCY, 2),
      maxRetries: readInt(env.LLM_MAX_RETRIES, 5),
      maxOutputTokens: readInt(env.LLM_MAX_OUTPUT_TOKENS, 4000),
    },
    retrieval: {
      timeoutMs: readInt(env.FETCH_TIMEOUT_MS, 10_000),
      maxBytes: readInt(env.FETCH_MAX_BYTES, 2_000_000),
      maxPages: readInt(env.CRAWL_MAX_PAGES, 12),
      concurrency: readInt(env.FETCH_CONCURRENCY, 4),
      allowPrivateHosts: readBool(env.ALLOW_PRIVATE_HOSTS, false),
      userAgent:
        env.CRAWLER_USER_AGENT ??
        "InterviewPrepKitBot/1.0 (+https://github.com/example/interview-prep-kit)",
    },
  };
}
