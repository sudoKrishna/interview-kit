import { describe, it, expect } from "vitest";
import { allocateSchedule } from "../src/pipeline/scheduler";
import type { Question } from "@prepkit/shared";

function q(id: string, reqs: string[], difficulty: 1 | 2 | 3 = 2, category: Question["category"] = "technical"): Question {
  return { id, requirement_ids: reqs, category, prompt: `p ${id}`, answer_outline: "a", difficulty, origin: "generated", pinned: false, edited: false };
}

describe("allocateSchedule", () => {
  const reqs = [
    { id: "r1", priority: "must" as const },
    { id: "r2", priority: "must" as const },
    { id: "r3", priority: "nice" as const },
  ];

  it("spans exactly the number of days requested", () => {
    for (const days of [1, 5, 30, 60]) {
      const { days: sched } = allocateSchedule([q("q1", ["r1"]), q("q2", ["r2"]), q("q3", ["r3"])], days, reqs);
      expect(sched).toHaveLength(days);
      expect(sched.map((d) => d.day)).toEqual(Array.from({ length: days }, (_, i) => i + 1));
    }
  });

  it("places every question exactly once", () => {
    const questions = Array.from({ length: 17 }, (_, i) => q(`q${i}`, [reqs[i % 3].id]));
    const { days, unplacedQuestionIds } = allocateSchedule(questions, 5, reqs);
    const all = days.flatMap((d) => d.question_ids);
    expect(new Set(all).size).toBe(all.length); // no duplicates
    expect(unplacedQuestionIds).toHaveLength(0);
  });

  it("puts must-have / harder material earlier, not on the last day", () => {
    const questions = [
      q("qN1", ["r3"], 1, "company-fit"),
      q("qM1", ["r1"], 3),
      q("qM2", ["r2"], 3),
      q("qN2", ["r3"], 1),
    ];
    const { days } = allocateSchedule(questions, 4, reqs);
    const lastDay = days[3];
    const mustQs = days.flatMap((d, i) => (i < 3 ? d.question_ids : []));
    expect(mustQs).toContain("qM1");
    expect(mustQs).toContain("qM2");
    expect(lastDay.question_ids).toContain("qN1"); // company-fit goes to review day
  });

  it("uses integer minutes only", () => {
    const { days } = allocateSchedule([q("q1", ["r1"])], 3, reqs);
    for (const d of days) expect(Number.isInteger(d.minutes)).toBe(true);
  });

  it("handles 1 day (everything on day 1)", () => {
    const { days } = allocateSchedule([q("q1", ["r1"]), q("q2", ["r2"])], 1, reqs);
    expect(days).toHaveLength(1);
    expect(days[0].question_ids).toHaveLength(2);
  });

  it("handles empty question sets", () => {
    const { days } = allocateSchedule([], 5, reqs);
    expect(days).toHaveLength(5);
    expect(days.every((d) => Array.isArray(d.question_ids))).toBe(true);
  });
});
