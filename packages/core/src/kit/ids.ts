/**
 * Stable, human-readable identifiers.
 *
 * Ids are scoped to a single kit: requirements are `r1, r2, ...`, questions
 * `q1, q2, ...`, flashcards `f1, f2, ...`. They stay stable for the life of a
 * kit so that coverage, the schedule and practice progress can all reference
 * them without ambiguity.
 */

const ID_PATTERN = (prefix: string) => new RegExp(`^${prefix}(\\d+)$`);

/** Highest numeric suffix currently in use for a prefix, or 0. */
export function maxIdSuffix(prefix: string, ids: Iterable<string>): number {
  const re = ID_PATTERN(prefix);
  let max = 0;
  for (const id of ids) {
    const match = re.exec(id);
    if (match?.[1]) {
      const n = Number.parseInt(match[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max;
}

/** Returns the next free id for a prefix given the ids already present. */
export function nextId(prefix: string, existing: Iterable<string>): string {
  return `${prefix}${maxIdSuffix(prefix, existing) + 1}`;
}

export interface IdFactory {
  (prefix: string): string;
}

/**
 * Creates a sequential id factory. Used while assembling a fresh kit so that
 * every item gets a unique id without repeatedly scanning existing arrays.
 */
export function createIdFactory(seed: Iterable<string> = []): IdFactory {
  const counters = new Map<string, number>();
  for (const id of seed) {
    const match = /^([a-z]+)(\d+)$/.exec(id);
    if (!match?.[1] || !match[2]) continue;
    const prefix = match[1];
    const n = Number.parseInt(match[2], 10);
    counters.set(prefix, Math.max(counters.get(prefix) ?? 0, n));
  }
  return (prefix: string) => {
    const n = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, n);
    return `${prefix}${n}`;
  };
}
