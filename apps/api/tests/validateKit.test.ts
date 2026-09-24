import { describe, it, expect } from "vitest";
import { validateKit } from "../src/pipeline/validateKit";
import type { Kit } from "@prepkit/shared";

function validKit(): Kit {
  return {
    source: {
      company: "Acme", company_url: "https://acme.com", role: "Backend Engineer",
      location: "Remote", jd_chars: 100, researched_at: new Date().toISOString(),
      pages_used: ["https://acme.com"],
    },
    company_brief: { summary: "s", what_they_do: "d", sources: ["https://acme.com"] },
    role: {
      title: "Backend Engineer", seniority: "senior",
      responsibilities: ["build things"],
      requirements: [{ id: "r1", text: "5+ years Node", kind: "technical", priority: "must" }],
    },
    questions: [{
      id: "q1", requirement_ids: ["r1"], category: "technical",
      prompt: "p", answer_outline: "a", difficulty: 2,
      origin: "generated", pinned: false, edited: false,
    }],
    flashcards: [{ id: "f1", front: "x", back: "y", requirement_ids: ["r1"], origin: "generated", pinned: false, edited: false }],
    schedule: {
      days_available: 2,
      days: [
        { day: 1, focus: "technical", question_ids: ["q1"], minutes: 30 },
        { day: 2, focus: "review", question_ids: [], minutes: 30 },
      ],
    },
    coverage: { uncovered_requirement_ids: [], passes: 1 },
  };
}

describe("validateKit (Appendix A structure)", () => {
  it("accepts a conforming kit", () => {
    const { valid, issues } = validateKit(validKit());
    expect(valid).toBe(true);
    expect(issues).toHaveLength(0);
  });

  it("rejects unknown requirement ids referenced by questions", () => {
    const kit = validKit();
    (kit.questions[0] as any).requirement_ids = ["r99"];
    const { valid, issues } = validateKit(kit);
    expect(valid).toBe(false);
    expect(issues.some((i) => i.message.includes("r99"))).toBe(true);
  });

  it("rejects non-integer minutes and float durations", () => {
    const kit = validKit();
    (kit.schedule.days[0] as any).minutes = 60.5;
    const { valid } = validateKit(kit);
    expect(valid).toBe(false);
  });

  it("rejects difficulty out of range", () => {
    const kit = validKit();
    (kit.questions[0] as any).difficulty = 4;
    expect(validateKit(kit).valid).toBe(false);
  });

  it("rejects schedule referencing a question id that does not exist", () => {
    const kit = validKit();
    kit.schedule.days[1].question_ids = ["qGhost"];
    expect(validateKit(kit).valid).toBe(false);
  });

  it("rejects duplicate requirement ids", () => {
    const kit = validKit();
    kit.role.requirements.push({ ...kit.role.requirements[0] });
    expect(validateKit(kit).valid).toBe(false);
  });

  it("stays structurally valid when a must-have has no question — that is a coverage gap, not a structure failure", () => {
    const kit = validKit();
    kit.questions = [];
    kit.schedule.days[0].question_ids = [];
    kit.schedule.days[1].question_ids = [];
    expect(validateKit(kit).valid).toBe(true);
  });

  it("rejects a question scheduled twice", () => {
    const kit = validKit();
    kit.schedule.days[1].question_ids = ["q1"]; // q1 already on day 1
    expect(validateKit(kit).valid).toBe(false);
  });
});
