import { Router } from "express";
import crypto from "crypto";
import { KitModel } from "../models";
import { requireAuth } from "../middleware/auth";
import { runPipeline } from "../pipeline/runPipeline";
import { validateKit } from "../pipeline/validateKit";
import { allocateSchedule } from "../pipeline/scheduler";

const router = Router();
router.use(requireAuth);

// list own kits (summary only)
router.get("/", async (req, res, next) => {
  try {
    const docs = await KitModel.find({ userId: req.user!.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      kits: docs.map((d) => ({
        id: d._id,
        status: d.status,
        company: d.kit?.source?.company ?? new URL(d.companyUrl).hostname,
        role: d.kit?.source?.role ?? null,
        days: d.days,
        error: d.error,
        createdAt: d.createdAt,
      })),
    });
  } catch (e) {
    next(e);
  }
});

// create a kit — long-running pipeline runs in the background; poll /progress
router.post("/", async (req, res, next) => {
  try {
    const { jd, company_url, days } = req.body ?? {};
    if (typeof jd !== "string" || jd.trim().length < 10) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "jd must be a non-trivial string." } });
    }
    if (typeof company_url !== "string" || !company_url.trim()) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "company_url is required." } });
    }
    const d = Number(days);
    if (!Number.isInteger(d) || d < 1 || d > 60) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "days must be an integer 1..60." } });
    }

    // duplicate submission: same user + same jd + same company → return existing
    const jdHash = crypto.createHash("sha256").update(jd.trim()).digest("hex");
    const dup = await KitModel.findOne({ userId: req.user!.id, jdHash, companyUrl: company_url.trim(), status: { $ne: "failed" } });
    if (dup) {
      return res.status(409).json({
        error: { code: "DUPLICATE_KIT", message: "You already have a kit for this posting.", kitId: String(dup._id) },
      });
    }

    const doc = await KitModel.create({
      userId: req.user!.id,
      status: "generating",
      jd: jd.trim(),
      jdHash,
      companyUrl: company_url.trim(),
      days: d,
      steps: [],
      error: null,
      kit: null,
      practice: {},
    });

    // fire-and-track generation (no queue needed for this scale; see README)
    runPipeline({ jd: jd.trim(), companyUrl: company_url.trim(), days: d }, {
      onStep: async (steps) => {
        try {
          await KitModel.updateOne({ _id: doc._id }, { steps, updatedAt: new Date() });
        } catch { /* progress update is best-effort */ }
      },
    })
      .then(async (kit) => {
        await KitModel.updateOne({ _id: doc._id }, { status: "ready", kit, updatedAt: new Date() });
      })
      .catch(async (err) => {
        await KitModel.updateOne(
          { _id: doc._id },
          { status: "failed", error: { code: err?.code ?? "PIPELINE_FAILED", message: String(err?.message ?? err).slice(0, 300) }, updatedAt: new Date() }
        );
      });

    res.status(202).json({ id: String(doc._id), status: "generating" });
  } catch (e) {
    next(e);
  }
});

// progress polling endpoint
router.get("/:id/progress", async (req, res, next) => {
  try {
    const doc = await KitModel.findOne({ _id: req.params.id, userId: req.user!.id }).lean();
    if (!doc) return res.status(404).json({ error: { code: "KIT_NOT_FOUND", message: "Kit not found." } });
    res.json({ id: String(doc._id), status: doc.status, steps: doc.steps, error: doc.error });
  } catch (e) {
    next(e);
  }
});

// get full kit
router.get("/:id", async (req, res, next) => {
  try {
    const doc = await KitModel.findOne({ _id: req.params.id, userId: req.user!.id }).lean();
    if (!doc) return res.status(404).json({ error: { code: "KIT_NOT_FOUND", message: "Kit not found." } });
    res.json({ id: String(doc._id), status: doc.status, error: doc.error, kit: doc.kit, practice: doc.practice });
  } catch (e) {
    next(e);
  }
});

// delete kit
router.delete("/:id", async (req, res, next) => {
  try {
    const r = await KitModel.deleteOne({ _id: req.params.id, userId: req.user!.id });
    if (r.deletedCount === 0) return res.status(404).json({ error: { code: "KIT_NOT_FOUND", message: "Kit not found." } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ── Builder mutations

// patch a section of the kit (brief, role, question, flashcard, schedule)
router.patch("/:id", async (req, res, next) => {
  try {
    const doc = await KitModel.findOne({ _id: req.params.id, userId: req.user!.id });
    if (!doc || !doc.kit) return res.status(404).json({ error: { code: "KIT_NOT_FOUND", message: "Kit not found." } });
    const { op } = req.body ?? {};

    const kit = doc.kit as any;
    switch (op) {
      case "editQuestion": {
        const q = kit.questions.find((x: any) => x.id === req.body.questionId);
        if (!q) throw badOp("question not found");
        Object.assign(q, pick(req.body, ["prompt", "answer_outline", "category", "difficulty", "requirement_ids"]));
        q.edited = true;
        break;
      }
      case "addQuestion": {
        const id = nextId(kit.questions.map((q: any) => q.id), "q");
        kit.questions.push({
          id,
          requirement_ids: req.body.requirement_ids ?? [],
          category: req.body.category ?? "technical",
          prompt: req.body.prompt ?? "",
          answer_outline: req.body.answer_outline ?? "",
          difficulty: req.body.difficulty ?? 2,
          origin: "manual",
          pinned: true,
          edited: false,
        });
        break;
      }
      case "deleteQuestion": {
        kit.questions = kit.questions.filter((q: any) => q.id !== req.body.questionId);
        for (const d of kit.schedule.days) {
          d.question_ids = d.question_ids.filter((id: string) => id !== req.body.questionId);
        }
        break;
      }
      case "reorderQuestions": {
        const order: string[] = req.body.order ?? [];
        kit.questions.sort((a: any, b: any) => order.indexOf(a.id) - order.indexOf(b.id));
        break;
      }
      case "togglePinQuestion": {
        const q = kit.questions.find((x: any) => x.id === req.body.questionId);
        if (!q) throw badOp("question not found");
        q.pinned = !q.pinned;
        break;
      }
      case "editFlashcard": {
        const f = kit.flashcards.find((x: any) => x.id === req.body.flashcardId);
        if (!f) throw badOp("flashcard not found");
        Object.assign(f, pick(req.body, ["front", "back", "requirement_ids"]));
        f.edited = true;
        break;
      }
      case "addFlashcard": {
        const id = nextId(kit.flashcards.map((f: any) => f.id), "f");
        kit.flashcards.push({
          id,
          front: req.body.front ?? "",
          back: req.body.back ?? "",
          requirement_ids: req.body.requirement_ids ?? [],
          origin: "manual",
          pinned: true,
          edited: false,
        });
        break;
      }
      case "deleteFlashcard": {
        kit.flashcards = kit.flashcards.filter((f: any) => f.id !== req.body.flashcardId);
        delete (doc.practice as any)?.[req.body.flashcardId];
        break;
      }
      case "editBrief": {
        Object.assign(kit.company_brief, pick(req.body, ["summary", "what_they_do"]));
        break;
      }
      case "regenerateSchedule": {
        // deterministic — no LLM involved in reallocation
        const { days } = allocateSchedule(kit.questions, doc.days, kit.role.requirements);
        kit.schedule = { days_available: doc.days, days };
        break;
      }
      default:
        throw badOp(`unknown op "${op}"`);
    }

    const { valid, issues } = validateKit(doc.kit);
    if (!valid) {
      return res.status(400).json({ error: { code: "KIT_INVALID", message: issues.map((i) => `${i.path}: ${i.message}`).join("; ") } });
    }
    doc.updatedAt = new Date();
    await doc.save();
    res.json({ kit: doc.kit });
  } catch (e) {
    next(e);
  }
});

// regenerate ONE section without touching user edits elsewhere
router.post("/:id/regenerate", async (req, res, next) => {
  try {
    const doc = await KitModel.findOne({ _id: req.params.id, userId: req.user!.id });
    if (!doc || !doc.kit) return res.status(404).json({ error: { code: "KIT_NOT_FOUND", message: "Kit not found." } });
    const kit = doc.kit as any;
    const { section, category } = req.body ?? {};

    if (section === "company_brief") {
      const { generateCompanyBrief } = await import("../pipeline/companyBrief");
      const { researchCompany } = await import("../pipeline/researchCompany");
      const research = await researchCompany(kit.source.company_url, kit.source.company, {
        allowPrivateUrls: false,
        maxPages: 4,
      });
      kit.company_brief = await generateCompanyBrief(kit.source.company, kit.source.company_url, research);
    } else if (section === "questions" && category) {
      const { generateQuestionsForRequirements, toKitQuestions } = await import("../pipeline/generateQuestions");
      // ONLY regenerate unpinned, unedited, generated questions in this category
      const keep = kit.questions.filter(
        (q: any) => q.category !== category || q.origin === "manual" || q.pinned || q.edited
      );
      const reqsForCategory = kit.role.requirements.filter((r: any) =>
        category === "behavioural" ? r.kind === "behavioural" : category === "technical" ? r.kind === "technical" : r.kind === "domain"
      );
      let newQs: any[] = [];
      try {
        const gen = await generateQuestionsForRequirements({
          category,
          requirements: reqsForCategory,
          hiringContext: "",
          companySummary: kit.company_brief.summary,
          seniority: kit.role.seniority,
          nextQuestionNumber: keep.length,
        });
        newQs = toKitQuestions(gen, category, keep.length);
      } catch {
        newQs = [];
      }
      kit.questions = [...keep, ...newQs];
      // refresh schedule deterministically to include the new question ids
      const { days } = allocateSchedule(kit.questions, doc.days, kit.role.requirements);
      kit.schedule = { days_available: doc.days, days };
    } else if (section === "schedule") {
      const { days } = allocateSchedule(kit.questions, doc.days, kit.role.requirements);
      kit.schedule = { days_available: doc.days, days };
    } else {
      throw badOp("unknown section");
    }

    const { valid, issues } = validateKit(doc.kit);
    if (!valid) {
      return res.status(400).json({ error: { code: "KIT_INVALID", message: issues.map((i) => `${i.path}: ${i.message}`).join("; ") } });
    }
    doc.updatedAt = new Date();
    await doc.save();
    res.json({ kit: doc.kit });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/practice", async (req, res, next) => {
  try {
    const doc = await KitModel.findOne({ _id: req.params.id, userId: req.user!.id });
    if (!doc) return res.status(404).json({ error: { code: "KIT_NOT_FOUND", message: "Kit not found." } });
    const { flashcardId, confidence } = req.body ?? {};
    if (!Number.isInteger(confidence) || confidence < 1 || confidence > 5) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "confidence must be integer 1..5" } });
    }
    const practice = (doc.practice ??= {} as any) as any;
    const prev = practice[flashcardId];
    practice[flashcardId] = {
      confidence,
      lastSeen: new Date().toISOString(),
      timesSeen: (prev?.timesSeen ?? 0) + 1,
    };
    doc.markModified("practice");
    await doc.save();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

function pick<T extends object>(body: T, keys: string[]): Partial<T> {
  const out: any = {};
  for (const k of keys) if ((body as any)?.[k] !== undefined) out[k] = (body as any)[k];
  return out;
}

function nextId(existing: string[], prefix: string): string {
  const nums = existing
    .map((id) => Number(id.replace(new RegExp(`^${prefix}`), "")))
    .filter((n) => Number.isInteger(n));
  return `${prefix}${(nums.length ? Math.max(...nums) : 0) + 1}`;
}

function badOp(message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code: "VALIDATION_ERROR" });
}

export default router;
