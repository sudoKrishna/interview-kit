"use client";
import { useState } from "react";
import type { Kit } from "@prepkit/shared";
import { api } from "@/lib/api";

export default function FlashcardList({ kit, id, onKit }: { kit: Kit; id: string; onKit: (k: Kit) => void }) {
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ front: string; back: string }>({ front: "", back: "" });
  const [adding, setAdding] = useState(false);

  async function mutate(body: unknown) {
    setBusy(true);
    try {
      const r = await api.mutate(id, body);
      onKit(r.kit);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="animate-fade-in space-y-4">
      <button onClick={() => setAdding(!adding)} className="btn-primary btn-sm">
        {adding ? "Close" : "+ Add flashcard"}
      </button>

      {adding && (
        <form
          onSubmit={(e) => { e.preventDefault(); mutate({ op: "addFlashcard", ...draft }); setAdding(false); setDraft({ front: "", back: "" }); }}
          className="surface-card space-y-3"
        >
          <input required placeholder="Front" value={draft.front} onChange={(e) => setDraft({ ...draft, front: e.target.value })} className="input" />
          <textarea required placeholder="Back" value={draft.back} onChange={(e) => setDraft({ ...draft, back: e.target.value })} rows={3} className="input" />
          <button className="btn-primary btn-sm" disabled={busy}>Add</button>
        </form>
      )}

      {kit.flashcards.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">No flashcards yet.</p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {kit.flashcards.map((f) => (
          <li key={f.id} className="surface-card">
            {editId === f.id ? (
              <form
                onSubmit={(e) => { e.preventDefault(); mutate({ op: "editFlashcard", flashcardId: f.id, ...draft }); setEditId(null); }}
                className="space-y-2"
              >
                <input value={draft.front} onChange={(e) => setDraft({ ...draft, front: e.target.value })} className="input" />
                <textarea value={draft.back} onChange={(e) => setDraft({ ...draft, back: e.target.value })} rows={3} className="input" />
                <div className="flex gap-2">
                  <button className="btn-primary btn-sm">Save</button>
                  <button type="button" onClick={() => setEditId(null)} className="btn-secondary btn-sm">Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex justify-between gap-2">
                  <p className="font-medium text-slate-900">{f.front}</p>
                  <span className="flex shrink-0 gap-1.5">
                    <button onClick={() => { setEditId(f.id); setDraft({ front: f.front, back: f.back }); }} className="btn-secondary btn-sm">Edit</button>
                    <button onClick={() => { if (confirm("Delete this card?")) mutate({ op: "deleteFlashcard", flashcardId: f.id }); }} className="btn-danger btn-sm">Del</button>
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{f.back}</p>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
