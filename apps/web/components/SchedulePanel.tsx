"use client";
import { useState } from "react";
import type { Kit } from "@prepkit/shared";
import { api } from "@/lib/api";

const CATEGORY_PILL: Record<string, string> = {
  technical: "pill-brand",
  behavioural: "pill-amber",
  "system-design": "pill-sky",
  "company-fit": "pill-neutral",
};

export default function SchedulePanel({ kit, id, onKit }: { kit: Kit; id: string; onKit: (k: Kit) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const questionById = new Map(kit.questions.map((q) => [q.id, q]));

  async function regenerate() {
    if (!confirm("Reallocate the schedule? Manual question edits and pins are kept — only the day plan is rebuilt.")) return;
    setBusy(true);
    setMsg("Reallocating…");
    try {
      const r = await api.regenerate(id, "schedule");
      onKit(r.kit);
      setMsg("Schedule reallocated");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {kit.schedule.days_available} days · must-have and harder material comes first · integer minutes only
        </p>
        <button onClick={regenerate} disabled={busy} className="btn-secondary btn-sm">
          ↻ Reallocate
        </button>
      </div>
      {msg && <p aria-live="polite" className="text-sm text-slate-600">{msg}</p>}

      <ol className="space-y-3">
        {kit.schedule.days.map((d) => (
          <li key={d.day} className="surface-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-900">
                Day {d.day} <span className="text-slate-400">·</span> <span className="font-normal text-slate-600">{d.focus}</span>
              </h3>
              <span className="pill-neutral">{d.minutes} min · {d.question_ids.length} question{d.question_ids.length === 1 ? "" : "s"}</span>
            </div>
            <ul className="mt-3 space-y-1.5">
              {d.question_ids.length === 0 && (
                <li className="text-sm text-slate-400">Rest / review — nothing scheduled.</li>
              )}
              {d.question_ids.map((qid) => {
                const q = questionById.get(qid);
                return (
                  <li key={qid} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className={`mt-0.5 ${CATEGORY_PILL[q?.category ?? ""] ?? "pill-neutral"}`}>{q?.category ?? "?"}</span>
                    {q?.prompt ?? qid}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
