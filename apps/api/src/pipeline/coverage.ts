import type { Kit, Question } from "@prepkit/shared";


export function findUncoveredRequirements(
  requirements: { id: string; priority: "must" | "nice" }[],
  questions: Pick<Question, "requirement_ids">[]
): string[] {
  const covered = new Set<string>();
  for (const q of questions) {
    for (const rid of q.requirement_ids) covered.add(rid);
  }
  return requirements
    .filter((r) => r.priority === "must" && !covered.has(r.id))
    .map((r) => r.id);
}

/** Must-have requirements with no question against them — the gaps the 2nd pass acts on. */
export function coverageGaps(kit: Pick<Kit, "role" | "questions">): string[] {
  const musts = kit.role.requirements.filter((r) => r.priority === "must");
  return findUncoveredRequirements(musts, kit.questions);
}
