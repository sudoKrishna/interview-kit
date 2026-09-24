export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

/**
 * Exponential backoff with jitter, capped. If the provider told us how long to
 * wait (`Retry-After`), we respect that instead of guessing.
 */
export function backoffDelay(attempt: number, retryAfterMs?: number): number {
  const exponential = Math.min(30_000, 800 * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 400);
  const computed = exponential + jitter;
  if (retryAfterMs !== undefined && retryAfterMs > 0) {
    return Math.min(60_000, Math.max(retryAfterMs, computed));
  }
  return computed;
}

/**
 * Bounds how many requests are in flight at once and spaces out the start of
 * each request. Free LLM tiers limit tokens per minute, so concurrency alone is
 * not enough: we also keep a minimum gap between dispatches and widen it when
 * the provider pushes back.
 */
export class RequestGate {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  private lastDispatch = 0;
  private minIntervalMs: number;

  constructor(
    private readonly maxConcurrency: number,
    initialIntervalMs = 0,
  ) {
    this.minIntervalMs = initialIntervalMs;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      await this.applySpacing();
      return await task();
    } finally {
      this.release();
    }
  }

  /** Called after a 429 to slow future dispatches down. */
  slowDown(extraMs: number): void {
    const next = this.minIntervalMs === 0 ? extraMs : this.minIntervalMs * 2;
    this.minIntervalMs = Math.min(15_000, next);
  }

  /** Useful in tests and diagnostics. */
  currentSpacingMs(): number {
    return this.minIntervalMs;
  }

  private async acquire(): Promise<void> {
    if (this.active < this.maxConcurrency) {
      this.active += 1;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
  }

  private release(): void {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) {
      this.active += 1;
      next();
    }
  }

  private async applySpacing(): Promise<void> {
    const now = Date.now();
    const wait = this.lastDispatch + this.minIntervalMs - now;
    if (wait > 0) await sleep(wait);
    this.lastDispatch = Date.now();
  }
}
