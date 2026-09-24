"use client";
import { useState, useMemo } from "react";
import type { Kit } from "@prepkit/shared";
import { api } from "@/lib/api";



const CONFIDENCE_LABELS = ["No idea", "Shaky", "Okay", "Solid", "Nailed it"];
const CONFIDENCE_STYLE = [
  "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
  "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100",
  "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100",
];

export default function PracticePanel({
  kit,
  id,
  initialPractice = {},
}: {
  kit: Kit;
  id: string;
  initialPractice?: Record<string, { confidence: number; lastSeen: string }>;
}) {
  const [practice, setPractice] = useState(initialPractice);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const ordered = useMemo(() => {
    const now = Date.now();
    const score = (f: typeof kit.flashcards[number]) => {
      const p = practice[f.id];
      if (!p) return 100; // never seen → first
      const days = (now - new Date(p.lastSeen).getTime()) / 86_400_000;
      return (6 - p.confidence) + days;
    };
    return [...kit.flashcards].sort((a, b) => score(b) - score(a));
  }, [kit.flashcards, practice]);

  const seenCount = Object.keys(practice).length;
  const card = ordered[idx];

  async function rate(confidence: number) {
    if (!card) return;
    // optimistic update — feels immediate, backend persists
    setPractice((p) => ({ ...p, [card.id]: { confidence, lastSeen: new Date().toISOString() } }));
    setRevealed(false);
    api.recordPractice(id, card.id, confidence).catch(() => {});
    if (idx < ordered.length - 1) setIdx(idx + 1);
  }

  if (kit.flashcards.length === 0) {
    return <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">No flashcards to practise yet.</p>;
  }

  return (
    <section className="animate-fade-in space-y-5">
      <div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-500"
            style={{ width: `${(seenCount / kit.flashcards.length) * 100}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          {seenCount}/{kit.flashcards.length} covered · session ordered least-confident-first
        </p>
      </div>

      {card && (
        <div className="surface-card text-center" aria-live="polite">
          <p className="text-xs text-slate-400">{card.id} · next up</p>
          <p className="mx-auto mt-4 max-w-md text-lg font-medium text-slate-900">{card.front}</p>
          {!revealed ? (
            <button onClick={() => setRevealed(true)} className="btn-primary mt-6">
              Reveal answer
            </button>
          ) : (
            <>
              <p className="mx-auto mt-6 max-w-md whitespace-pre-line text-slate-700">{card.back}</p>
              <p className="mt-6 text-xs font-medium uppercase tracking-wide text-slate-400">How confident did you feel?</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {CONFIDENCE_LABELS.map((label, i) => (
                  <button
                    key={i}
                    onClick={() => rate(i + 1)}
                    className={`rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors ${CONFIDENCE_STYLE[i]}`}
                  >
                    {i + 1} · {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {card && (
        <p className="text-center text-sm">
          <button onClick={() => { setIdx((i) => Math.min(i + 1, ordered.length - 1)); setRevealed(false); }} className="font-medium text-brand-700 hover:text-brand-800">
            skip →
          </button>
        </p>
      )}
    </section>
  );
}
