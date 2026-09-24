import { describe, it, expect } from "vitest";
import { findUncoveredRequirements, coverageGaps } from "../src/pipeline/coverage";
import type { Kit } from "@prepkit/shared";

describe("coverage checking", () => {
  const reqs = [
    { id: "r1", priority: "must" as const },
    { id: "r2", priority: "must" as const },
    { id: "r3", priority: "nice" as const },
  ];

  it("reports must-have requirements with no question as gaps", () => {
    const gaps = findUncoveredRequirements(reqs, [{ requirement_ids: ["r1"] }]);
    expect(gaps).toEqual(["r2"]);
  });

  it("nice-to-haves never count as gaps", () => {
    const gaps = findUncoveredRequirements(reqs, []);
    expect(gaps).toEqual(["r1", "r2"]);
  });

  it("coverageGaps only looks at musts", () => {
    const kit = {
      role: { requirements: reqs.map((r) => ({ ...r, text: "t", kind: "technical" as const })) },
      questions: [{ requirement_ids: ["r1", "r3"] }],
    } as unknown as Pick<Kit, "role" | "questions">;
    expect(coverageGaps(kit)).toEqual(["r2"]);
  });

  it("a question covering any of several requirements marks them all covered", () => {
    const gaps = findUncoveredRequirements(reqs, [{ requirement_ids: ["r1", "r2", "r3"] }]);
    expect(gaps).toHaveLength(0);
  });
});
