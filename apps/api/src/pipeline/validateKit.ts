import type { Kit } from "@prepkit/shared";



const CATEGORIES = ["technical", "behavioural", "system-design", "company-fit"];
const KINDS = ["technical", "behavioural", "domain"];

export interface ValidationIssue {
  path: string;
  message: string;
}

export function validateKit(kit: unknown): { valid: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const k = kit as Kit;

  const req = (cond: boolean, path: string, message: string) => {
    if (!cond) issues.push({ path, message });
  };

  req(!!k && typeof k === "object", "kit", "kit must be an object");
  if (!k || typeof k !== "object") return { valid: false, issues };

  // source
  const s = k.source;
  req(!!s?.company && typeof s.company === "string", "source.company", "required string");
  req(!!s?.company_url, "source.company_url", "required string");
  req(!!s?.role, "source.role", "required string");
  req(typeof s?.jd_chars === "number" && Number.isInteger(s.jd_chars), "source.jd_chars", "required integer");
  req(!!s?.researched_at, "source.researched_at", "required ISO date");
  req(Array.isArray(s?.pages_used), "source.pages_used", "required array");

  // company_brief
  req(!!k.company_brief?.summary, "company_brief.summary", "required string");
  req(!!k.company_brief?.what_they_do, "company_brief.what_they_do", "required string");
  req(Array.isArray(k.company_brief?.sources), "company_brief.sources", "required array");

  // role
  req(!!k.role?.title, "role.title", "required string");
  req(Array.isArray(k.role?.responsibilities), "role.responsibilities", "required array");
  req(Array.isArray(k.role?.requirements), "role.requirements", "required array");

  const reqIds = new Set<string>();
  (k.role?.requirements ?? []).forEach((r, i) => {
    req(!!r.id, `role.requirements[${i}].id`, "required id");
    req(!!r.text, `role.requirements[${i}].text`, "required text");
    req(KINDS.includes(r.kind), `role.requirements[${i}].kind`, `must be one of ${KINDS}`);
    req(r.priority === "must" || r.priority === "nice", `role.requirements[${i}].priority`, "must be must|nice");
    if (r.id) {
      req(!reqIds.has(r.id), `role.requirements[${i}].id`, `duplicate requirement id ${r.id}`);
      reqIds.add(r.id);
    }
  });

  // questions
  req(Array.isArray(k.questions), "questions", "required array");
  const questionIds = new Set<string>();
  (k.questions ?? []).forEach((q, i) => {
    req(!!q.id, `questions[${i}].id`, "required id");
    if (q.id) {
      req(!questionIds.has(q.id), `questions[${i}].id`, `duplicate question id ${q.id}`);
      questionIds.add(q.id);
    }
    req(Array.isArray(q.requirement_ids), `questions[${i}].requirement_ids`, "required array");
    (q.requirement_ids ?? []).forEach((rid, j) =>
      req(reqIds.has(rid), `questions[${i}].requirement_ids[${j}]`, `unknown requirement id ${rid}`)
    );
    req(CATEGORIES.includes(q.category), `questions[${i}].category`, `must be one of ${CATEGORIES}`);
    req(!!q.prompt, `questions[${i}].prompt`, "required string");
    req(!!q.answer_outline, `questions[${i}].answer_outline`, "required string");
    req(
      typeof q.difficulty === "number" && Number.isInteger(q.difficulty) && q.difficulty >= 1 && q.difficulty <= 3,
      `questions[${i}].difficulty`,
      "must be integer 1-3"
    );
  });

  // flashcards
  req(Array.isArray(k.flashcards), "flashcards", "required array");
  (k.flashcards ?? []).forEach((f, i) => {
    req(!!f.id, `flashcards[${i}].id`, "required id");
    req(!!f.front, `flashcards[${i}].front`, "required string");
    req(!!f.back, `flashcards[${i}].back`, "required string");
    (f.requirement_ids ?? []).forEach((rid, j) =>
      req(reqIds.has(rid), `flashcards[${i}].requirement_ids[${j}]`, `unknown requirement id ${rid}`)
    );
  });

  // schedule
  const sch = k.schedule;
  req(typeof sch?.days_available === "number" && sch.days_available >= 1, "schedule.days_available", "required positive integer");
  req(Array.isArray(sch?.days), "schedule.days", "required array");
  const scheduledIds = new Set<string>();
  (sch?.days ?? []).forEach((d, i) => {
    req(Number.isInteger(d.day) && d.day >= 1, `schedule.days[${i}].day`, "required 1-based integer day");
    req(!!d.focus, `schedule.days[${i}].focus`, "required string");
    req(Array.isArray(d.question_ids), `schedule.days[${i}].question_ids`, "required array");
    req(Number.isInteger(d.minutes) && d.minutes > 0, `schedule.days[${i}].minutes`, "required positive integer minutes");
    (d.question_ids ?? []).forEach((qid, j) =>
      req(questionIds.has(qid), `schedule.days[${i}].question_ids[${j}]`, `unknown question id ${qid}`)
    );
    for (const qid of d.question_ids ?? []) {
      req(!scheduledIds.has(qid), `schedule.days[${i}]`, `question ${qid} scheduled twice`);
      scheduledIds.add(qid);
    }
  });


  // coverage
  req(Array.isArray(k.coverage?.uncovered_requirement_ids), "coverage.uncovered_requirement_ids", "required array");
  req(Number.isInteger(k.coverage?.passes), "coverage.passes", "required integer");

  return { valid: issues.length === 0, issues };
}
