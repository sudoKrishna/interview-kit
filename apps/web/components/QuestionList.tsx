"use client";
import { useState } from "react";
import type { Kit, Question, QuestionCategory } from "@prepkit/shared";
import { api } from "@/lib/api";

const CATEGORIES: QuestionCategory[] = ["technical", "behavioural", "system-design", "company-fit"];

const CATEGORY_PILL: Record<string, string> = {
  technical: "pill-brand",
  behavioural: "pill-amber",
  "system-design": "pill-sky",
  "company-fit": "pill-neutral",
};

export default function QuestionList({ kit, id, onKit }: { kit: Kit; id: string; onKit: (k: Kit) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Question>>({});
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState<Partial<Question>>({ category: "technical", requirement_ids: [] });

  async function mutate(body: unknown) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.mutate(id, body);
      onKit(r.kit);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function regenerateCategory(category: QuestionCategory) {
    if (!confirm(`Regenerate the ${category} category? Questions you wrote, pinned or edited are kept; everything else generated in this category is replaced.`)) return;
    setBusy(true);
    setMsg("Regenerating…");
    try {
      const r = await api.regenerate(id, "questions", category);
      onKit(r.kit);
      setMsg("Category regenerated — your edits were preserved");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  function move(qid: string, dir: -1 | 1) {
    const order = kit.questions.map((q) => q.id);
    const i = order.indexOf(qid);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    mutate({ op: "reorderQuestions", order });
  }

  function startEdit(q: Question) {
    setOpenId(q.id === openId ? null : q.id);
    setDraft({ prompt: q.prompt, answer_outline: q.answer_outline, category: q.category, difficulty: q.difficulty });
  }

  return (
    <section className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setAdding(!adding)} className="btn-primary btn-sm">
          {adding ? "Close" : "+ Add question"}
        </button>
        <span className="mx-1 h-4 w-px bg-slate-200" />
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => regenerateCategory(c)}
            disabled={busy || !kit.questions.some((q) => q.category === c)}
            className="btn-secondary btn-sm"
            title={`Regenerate ${c} — manual/pinned/edited questions survive`}
          >
            ↻ {c}
          </button>
        ))}
      </div>
      {msg && <p aria-live="polite" className="text-sm text-slate-600">{msg}</p>}

      {adding && (
        <form
          onSubmit={(e) => { e.preventDefault(); mutate({ op: "addQuestion", ...newDraft }); setAdding(false); setNewDraft({ category: "technical", requirement_ids: [] }); }}
          className="surface-card space-y-3"
        >
          <input
            required placeholder="Question prompt" value={newDraft.prompt ?? ""}
            onChange={(e) => setNewDraft({ ...newDraft, prompt: e.target.value })}
            className="input"
          />
          <textarea
            placeholder="Answer outline" value={newDraft.answer_outline ?? ""}
            onChange={(e) => setNewDraft({ ...newDraft, answer_outline: e.target.value })}
            className="input" rows={3}
          />
          <select
            value={newDraft.category}
            onChange={(e) => setNewDraft({ ...newDraft, category: e.target.value as QuestionCategory })}
            className="input w-auto"
          >
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button className="btn-primary btn-sm">Add</button>
        </form>
      )}

      {kit.questions.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
          No questions — the description may have been too thin. You can add some by hand.
        </p>
      )}

      <ul className="space-y-3">
        {kit.questions.map((q, i) => (
          <li key={q.id} className="surface-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                <span className="flex gap-1">
                  <button aria-label="Move up" onClick={() => move(q.id, -1)} disabled={i === 0} className="rounded-lg border border-slate-200 px-1.5 py-0.5 hover:bg-slate-50 disabled:opacity-30">↑</button>
                  <button aria-label="Move down" onClick={() => move(q.id, 1)} disabled={i === kit.questions.length - 1} className="rounded-lg border border-slate-200 px-1.5 py-0.5 hover:bg-slate-50 disabled:opacity-30">↓</button>
                </span>
                <span className={CATEGORY_PILL[q.category] ?? "pill-neutral"}>{q.category}</span>
                <span className="pill-neutral">d{q.difficulty}</span>
                {(q.origin === "manual" || q.pinned) && <span title="survives regeneration" className="pill-amber">{q.pinned ? "pinned" : "manual"}</span>}
                {q.edited && <span className="pill-sky">edited</span>}
                <span className="text-slate-400">{q.requirement_ids.join(", ")}</span>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => mutate({ op: "togglePinQuestion", questionId: q.id })} className="btn-secondary btn-sm">
                  {q.pinned ? "Unpin" : "Pin"}
                </button>
                <button onClick={() => startEdit(q)} className="btn-secondary btn-sm">Edit</button>
                <button onClick={() => { if (confirm("Delete this question?")) mutate({ op: "deleteQuestion", questionId: q.id }); }} className="btn-danger btn-sm">Delete</button>
              </div>
            </div>

            {openId === q.id ? (
              <form
                onSubmit={(e) => { e.preventDefault(); mutate({ op: "editQuestion", questionId: q.id, ...draft }); setOpenId(null); }}
                className="mt-4 space-y-3"
              >
                <textarea
                  value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} rows={2}
                  className="input"
                  aria-label="Question prompt"
                />
                <textarea
                  value={draft.answer_outline} onChange={(e) => setDraft({ ...draft, answer_outline: e.target.value })} rows={4}
                  placeholder="Answer outline"
                  className="input"
                  aria-label="Answer outline"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value as QuestionCategory })}
                    className="input w-auto"
                    aria-label="Category"
                  >
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <select
                    value={draft.difficulty}
                    onChange={(e) => setDraft({ ...draft, difficulty: Number(e.target.value) as 1 | 2 | 3 })}
                    className="input w-auto"
                    aria-label="Difficulty"
                  >
                    <option value={1}>d1</option>
                    <option value={2}>d2</option>
                    <option value={3}>d3</option>
                  </select>
                  <button className="btn-primary btn-sm">Save</button>
                  <button type="button" onClick={() => setOpenId(null)} className="btn-secondary btn-sm">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p className="mt-4 font-medium text-slate-900">{q.prompt}</p>
                <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{q.answer_outline}</p>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
