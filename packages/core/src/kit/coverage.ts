import type { Question, Requirement } from "./schema";

/**
 * Coverage is computed in code, never by the model.
 *
 * A requirement is "covered" when at least one question references its id. This
 * is the single source of truth used by the second pass to decide what is still
 * missing. Keeping it deterministic means two runs over the same questions
 * always agree on whether a requirement is covered.
 */

export interface CoverageReport {
  /** Requirement ids referenced by at least one question. */
  coveredRequirementIds: string[];
  /** Requirement ids referenced by no question. */
  uncoveredRequirementIds: string[];
  /** Uncovered ids that are must-haves (the ones that block a kit from shipping). */
  uncoveredMustHaveIds: string[];
  /** Uncovered ids that are nice-to-haves. */
  uncoveredNiceToHaveIds: string[];
  /** requirement id -> question ids that reference it. */
  requirementCoverage: Record<string, string[]>;
  /** Questions that reference no known requirement id (a data-integrity signal). */
  orphanQuestionIds: string[];
}

export function checkCoverage(
  requirements: readonly Requirement[],
  questions: readonly Question[],
): CoverageReport {
  const known = new Set(requirements.map((r) => r.id));
  const requirementCoverage: Record<string, string[]> = {};
  for (const requirement of requirements) {
    requirementCoverage[requirement.id] = [];
  }

  const orphanQuestionIds: string[] = [];
  for (const question of questions) {
    const validRefs = question.requirement_ids.filter((id) => known.has(id));
    if (validRefs.length === 0) orphanQuestionIds.push(question.id);
    for (const id of validRefs) {
      requirementCoverage[id]?.push(question.id);
    }
  }

  const coveredRequirementIds: string[] = [];
  const uncoveredRequirementIds: string[] = [];
  const uncoveredMustHaveIds: string[] = [];
  const uncoveredNiceToHaveIds: string[] = [];

  for (const requirement of requirements) {
    const covered = (requirementCoverage[requirement.id]?.length ?? 0) > 0;
    if (covered) {
      coveredRequirementIds.push(requirement.id);
      continue;
    }
    uncoveredRequirementIds.push(requirement.id);
    if (requirement.priority === "must") uncoveredMustHaveIds.push(requirement.id);
    else uncoveredNiceToHaveIds.push(requirement.id);
  }

  return {
    coveredRequirementIds,
    uncoveredRequirementIds,
    uncoveredMustHaveIds,
    uncoveredNiceToHaveIds,
    requirementCoverage,
    orphanQuestionIds,
  };
}

/**
 * Orders gaps so the second pass tackles must-haves before nice-to-haves, and
 * technical/domain requirements before behavioural ones (they are harder to
 * invent a plausible question for, so they benefit from being attempted first).
 */
export function prioritiseGaps(
  report: CoverageReport,
  requirements: readonly Requirement[],
): Requirement[] {
  const byId = new Map(requirements.map((r) => [r.id, r]));
  const kindRank: Record<Requirement["kind"], number> = {
    technical: 0,
    domain: 1,
    behavioural: 2,
  };
  return report.uncoveredRequirementIds
    .map((id) => byId.get(id))
    .filter((r): r is Requirement => Boolean(r))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === "must" ? -1 : 1;
      return kindRank[a.kind] - kindRank[b.kind];
    });
}
