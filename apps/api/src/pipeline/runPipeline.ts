import type { Kit, PipelineStep, Question, QuestionCategory } from "@prepkit/shared";
import { config } from "../config";
import { extractRequirements } from "./extractRequirements";
import { researchCompany } from "./researchCompany";
import { generateCompanyBrief } from "./companyBrief";
import {
  generateQuestionsForRequirements,
  toKitQuestions,
} from "./generateQuestions";
import { generateFlashcards } from "./generateFlashcards";
import { coverageGaps } from "./coverage";
import { allocateSchedule } from "./scheduler";
import { validateKit } from "./validateKit";

export interface PipelineEvents {
  onStep?: (steps: PipelineStep[]) => void;
}

export async function runPipeline(
  input: { jd: string; companyUrl: string; days: number },
  events: PipelineEvents = {}
): Promise<Kit> {
  const steps: PipelineStep[] = [
    { key: "extract", label: "Extracting requirements from the job description", status: "pending" },
    { key: "crawl", label: "Crawling the company site", status: "pending" },
    { key: "hiring", label: "Finding hiring-process and about pages", status: "pending" },
    { key: "discussion", label: "Searching public interview discussion", status: "pending" },
    { key: "brief", label: "Writing the company brief", status: "pending" },
    { key: "questions", label: "Generating the question bank", status: "pending" },
    { key: "coverage", label: "Checking coverage and filling gaps", status: "pending" },
    { key: "flashcards", label: "Creating flashcards", status: "pending" },
    { key: "schedule", label: "Allocating the study schedule", status: "pending" },
    { key: "validate", label: "Validating the kit", status: "pending" },
  ];
  const emit = () => events.onStep?.(steps.map((s) => ({ ...s })));
  const mark = (key: string, status: PipelineStep["status"], detail?: string) => {
    const s = steps.find((x) => x.key === key)!;
    s.status = status;
    s.detail = detail;
    emit();
  };

  // ── Step 1: extraction (the only step a thin JD cannot fail gracefully) ──
  mark("extract", "running");
  const extraction = await extractRequirements(input.jd);
  mark("extract", "done", `${extraction.requirements.length} requirements extracted`);

  const companyUrl = normalizeUrl(input.companyUrl);

  // ── Step 2-4: research, degrading honestly 
  mark("crawl", "running");
  let research;
  try {
    research = await researchCompany(companyUrl, extraction.company, {
      allowPrivateUrls: config.pipeline.allowPrivateUrls,
      maxPages: config.pipeline.crawlMaxPages,
    });
  } catch (e: any) {
    research = { crawl: { pages: [], failures: [{ url: companyUrl, reason: String(e?.message ?? e) }], hiringPageFound: false }, discussion: null };
  }
  mark("crawl", research.crawl.pages.length > 0 ? "done" : "failed",
    research.crawl.failures.length
      ? `sources skipped: ${research.crawl.failures.map((f) => f.reason).join("; ")}`
      : `${research.crawl.pages.length} pages fetched`);

  const hiringPages = research.crawl.pages.filter((p) => p.purpose === "hiring");
  mark("hiring", hiringPages.length ? "done" : "skipped",
    hiringPages.length ? hiringPages[0].url : "no hiring page discovered on this site");
  mark("discussion", research.discussion?.found ? "done" : "skipped",
    research.discussion?.found ? `${research.discussion.snippets.length} discussion sources found` : "no public discussion found");

  // ── Step 5: company brief 
  mark("brief", "running");
  const brief = await generateCompanyBrief(extraction.company, companyUrl, research);
  mark("brief", "done");

  // ── Step 6: questions, one call per category
  mark("questions", "running");
  const domainReqs = extraction.requirements.filter((r) => r.kind === "domain");

  const technicalReqs = extraction.requirements.filter((r) => r.kind === "technical").concat(domainReqs);
  const behaviouralReqs = extraction.requirements.filter((r) => r.kind === "behavioural");
  const seniority = extraction.seniority;
  const hiringContext = hiringPages.map((p) => p.text).join("\n\n").slice(0, 6000);
  const allMusts = extraction.requirements.filter((r) => r.priority === "must");

  const questions: Question[] = [];
  let qIndex = 0;

  const batches: { category: QuestionCategory; reqs: typeof extraction.requirements }[] = [
    { category: "technical", reqs: technicalReqs },
    { category: "behavioural", reqs: behaviouralReqs },
  ];
  if (["senior", "staff", "lead"].includes(seniority)) {
    batches.push({ category: "system-design", reqs: domainReqs.length ? domainReqs : technicalReqs.slice(0, 3) });
  }
  if (hiringPages.length || brief.summary) {
    batches.push({ category: "company-fit", reqs: allMusts.slice(0, 3) });
  }

  for (const batch of batches) {
    if (batch.reqs.length === 0) continue;
    try {
      const gen = await generateQuestionsForRequirements({
        category: batch.category,
        requirements: batch.reqs,
        hiringContext,
        companySummary: brief.summary,
        seniority,
        nextQuestionNumber: qIndex,
      });
      const kitQs = toKitQuestions(gen, batch.category, qIndex);
      questions.push(...kitQs);
      qIndex += kitQs.length;
    } catch {
      
      continue;
    }
  }
  mark("questions", "done", `${questions.length} questions across ${new Set(questions.map((q) => q.category)).size} categories`);

  // ── Step 7: deterministic coverage check + bounded second pass
  mark("coverage", "running");
  let passes = 1;
  let gaps = coverageGaps({ role: { requirements: extraction.requirements } as any, questions });

  while (gaps.length > 0 && passes < config.pipeline.maxCoveragePasses) {
    const gapReqs = extraction.requirements.filter((r) => gaps.includes(r.id));
    try {
      const gen = await generateQuestionsForRequirements({
        category: "technical",
        requirements: gapReqs,
        hiringContext,
        companySummary: brief.summary,
        seniority,
        nextQuestionNumber: qIndex,
      });
      const kitQs = toKitQuestions(gen, "technical", qIndex);
      for (const q of kitQs) {
       
        q.category = (gapReqs.find((r) => r.id === q.requirement_ids[0])?.kind === "behavioural"
          ? "behavioural"
          : "technical") as QuestionCategory;
        questions.push(q);
        qIndex++;
      }
    } catch {
      break; 
    }
    passes++;
    gaps = coverageGaps({ role: { requirements: extraction.requirements } as any, questions });
  }
  mark("coverage", "done",
    gaps.length ? `${gaps.length} must-have requirement(s) still uncovered after ${passes} pass(es)` : `all must-haves covered after ${passes} pass(es)`);

  // ── Step 8: flashcards 
  mark("flashcards", "running");
  let flashcards: Kit["flashcards"] = [];
  try {
    flashcards = await generateFlashcards(extraction.requirements, questions);
  } catch {
    flashcards = [];
  }
  mark("flashcards", "done", `${flashcards.length} cards`);

  // ── Step 9: deterministic schedule 
  mark("schedule", "running");
  const { days } = allocateSchedule(questions, input.days, extraction.requirements);
  mark("schedule", "done", `${days.length} days allocated`);

  const kit: Kit = {
    source: {
      company: extraction.company,
      company_url: companyUrl,
      role: extraction.title,
      location: extraction.location,
      jd_chars: input.jd.length,
      researched_at: new Date().toISOString(),
      pages_used: research.crawl.pages.map((p) => p.url),
    },
    company_brief: brief,
    role: {
      title: extraction.title,
      seniority: extraction.seniority,
      responsibilities: extraction.responsibilities,
      requirements: extraction.requirements,
    },
    questions,
    flashcards,
    schedule: { days_available: input.days, days },
    coverage: { uncovered_requirement_ids: gaps, passes },
  };

  // ── Step 10: validate before returning 
  mark("validate", "running");
  const { valid, issues } = validateKit(kit);
  mark("validate", valid ? "done" : "failed",
    valid ? "kit structure valid" : issues.map((i) => `${i.path}: ${i.message}`).join("; ").slice(0, 300));
  if (!valid) {
    throw Object.assign(new Error("KIT_INVALID"), {
      code: "KIT_INVALID",
      issues,
    });
  }
  return kit;
}

export function normalizeUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  try {
    return new URL(s).toString();
  } catch {
    return new URL(`https://${s}`).toString();
  }
}
