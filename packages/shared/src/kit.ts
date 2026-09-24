/**
 * Shared types — the exact Appendix A "Kit" structure, plus the batch
 * evaluator's input/output shapes (Appendix B).
 *
 * Field names here are the contract between the API pipeline, the database,
 * and the web UI. They are snake_case where Appendix A specifies snake_case.
 */

// ── Role / requirements ────────────────────────────────────────────────

export type RequirementKind = "technical" | "behavioural" | "domain";
export type RequirementPriority = "must" | "nice";

export interface Requirement {
  id: string; // stable, e.g. "r1"
  text: string;
  kind: RequirementKind;
  priority: RequirementPriority;
}

// ── Questions ───────────────────────────────────────────────────────────

export type QuestionCategory = "technical" | "behavioural" | "system-design" | "company-fit";

export interface Question {
  id: string; // stable, e.g. "q1"
  requirement_ids: string[]; // references Requirement.id
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  origin: "generated" | "manual";
  pinned: boolean; // survives section regeneration
  edited: boolean; // user-modified — also survives regeneration
}

// ── Flashcards ──────────────────────────────────────────────────────────

export interface Flashcard {
  id: string; // stable, e.g. "f1"
  front: string;
  back: string;
  requirement_ids: string[];
  origin: "generated" | "manual";
  pinned: boolean;
  edited: boolean;
}

// ── Schedule ────────────────────────────────────────────────────────────

export interface ScheduleDay {
  day: number; // 1-based
  focus: string; // human-readable focus for the day
  question_ids: string[]; // references Question.id
  minutes: number; // integer minutes for the day
}

// ── Company brief / sources ─────────────────────────────────────────────

export interface CompanyBrief {
  summary: string;
  what_they_do: string;
  sources: string[]; // urls actually retrieved — nothing cited that wasn't fetched
}

export interface KitSource {
  company: string;
  company_url: string;
  role: string;
  location: string;
  jd_chars: number; // integer length of the pasted JD
  researched_at: string; // ISO timestamp
  pages_used: string[]; // urls fetched during research
}

// ── Pipeline progress ───────────────────────────────────────────────────

export type PipelineStepStatus = "pending" | "running" | "done" | "skipped" | "failed";

export interface PipelineStep {
  key: string;
  label: string;
  status: PipelineStepStatus;
  detail?: string;
}

// ── The Kit (Appendix A) ────────────────────────────────────────────────

export interface Kit {
  source: KitSource;
  company_brief: CompanyBrief;
  role: {
    title: string;
    seniority: string;
    responsibilities: string[];
    requirements: Requirement[];
  };
  questions: Question[];
  flashcards: Flashcard[];
  schedule: {
    days_available: number;
    days: ScheduleDay[];
  };
  coverage: {
    uncovered_requirement_ids: string[]; // must-haves with no question after all passes
    passes: number; // coverage passes actually run
  };
}

// ── Batch evaluation (Appendix B) ───────────────────────────────────────

export interface BatchCase {
  id: string; // case identifier, e.g. "case-1"
  jd: string;
  company_url: string;
  days: number; // integer 1..60
}

export interface BatchResult {
  id: string;
  status: "ok" | "failed";
  kit: Kit | null; // null when status === "failed"
  error: { code: string; message: string } | null;
}

export interface BatchOutput {
  version: string;
  generated_at: string; // ISO timestamp
  kits: BatchResult[];
}
