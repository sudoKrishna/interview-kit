import { config } from "../config";



export class LlmError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function llmJson<T>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<T> {
  const raw = await llmText(opts);
  return parseJsonStrict<T>(raw);
}

export async function llmText(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const { system, user, maxTokens = 4096, temperature = 0.3 } = opts;
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt <= config.llm.maxRetries; attempt++) {
    try {
      const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.llm.apiKey}`,
        },
        body: JSON.stringify({
          model: config.llm.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
        }),
      });

      if (res.status === 429 || res.status >= 500) {
        const wait = backoffMs(attempt);
        await sleep(wait);
        lastErr = new LlmError("LLM_RATE_LIMIT", `LLM ${res.status}; backing off ${wait}ms (attempt ${attempt + 1})`);
        continue;
      }
      if (!res.ok) {
        throw new LlmError("LLM_ERROR", `LLM returned ${res.status}: ${await safeText(res)}`);
      }
      const data: any = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new LlmError("LLM_EMPTY", "LLM returned an empty completion");
      }
      return content;
    } catch (e: any) {
      if (e instanceof LlmError && e.code === "LLM_ERROR") throw e;
      lastErr = e;
      await sleep(backoffMs(attempt));
    }
  }
  throw lastErr ?? new LlmError("LLM_FAILED", "LLM call failed");
}

/** Strip markdown fences, find the outermost JSON value, parse or throw. */
export function parseJsonStrict<T>(raw: string): T {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const first = Math.min(
    ...[s.indexOf("{"), s.indexOf("[")].filter((i) => i >= 0)
  );
  const lastBrace = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (Number.isFinite(first) && lastBrace > first) s = s.slice(first, lastBrace + 1);
  try {
    return JSON.parse(s) as T;
  } catch {
    throw new LlmError("LLM_BAD_JSON", `Model returned invalid JSON (len ${raw.length})`);
  }
}

function backoffMs(attempt: number): number {
  return Math.min(30_000, 1000 * 2 ** attempt + Math.floor(Math.random() * 500));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "<unreadable>";
  }
}
