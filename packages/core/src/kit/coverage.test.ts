import { describe, expect, it } from "vitest";
import { checkCoverage, prioritiseGaps } from "./coverage";
import type { Question, Requirement } from "./schema";

const requirements: Requirement[] = [
  { id: "r1", text: "React", kind: "technical", priority: "must" },
  { id: "r2", text: "Mentoring", kind: "behavioural", priority: "must" },
  { id: "r3", text: "Kubernetes", kind: "domain", priority: "nice" },
];

const q = (id: string, requirement_ids: string[]): Question => ({
  id,
  requirement_ids,
  category: "technical",
  prompt: id,
  answer_outline: "",
  difficulty: 2,
});

describe("checkCoverage", () => {
  it("separates covered from uncovered requirements", () => {
    const report = checkCoverage(requirements, [q("q1", ["r1"]), q("q2", ["r1"])]);
    expect(report.coveredRequirementIds).toEqual(["r1"]);
    expect(report.uncoveredRequirementIds).toEqual(["r2", "r3"]);
    expect(report.uncoveredMustHaveIds).toEqual(["r2"]);
    expect(report.uncoveredNiceToHaveIds).toEqual(["r3"]);
    expect(report.requirementCoverage.r1).toEqual(["q1", "q2"]);
  });

  it("flags questions that reference no known requirement", () => {
    const report = checkCoverage(requirements, [q("q1", ["nope"])]);
    expect(report.orphanQuestionIds).toEqual(["q1"]);
    expect(report.uncoveredMustHaveIds).toEqual(["r1", "r2"]);
  });
});

describe("prioritiseGaps", () => {
  it("orders must-haves first, then technical before behavioural", () => {
    const report = checkCoverage(requirements, []);
    const ordered = prioritiseGaps(report, requirements).map((r) => r.id);
    expect(ordered.slice(0, 2)).toEqual(["r1", "r2"]);
    expect(ordered[2]).toBe("r3");
  });
});
