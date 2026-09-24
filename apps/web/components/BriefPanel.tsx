"use client";
import { useState } from "react";
import type { Kit } from "@prepkit/shared";
import { api } from "@/lib/api";

export default function BriefPanel({ kit, id, onKit }: { kit: Kit; id: string; onKit: (k: Kit) => void }) {
  const [summary, setSummary] = useState(kit.company_brief.summary);
  const [what, setWhat] = useState(kit.company_brief.what_they_do);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    try {
      const r = await api.mutate(id, { op: "editBrief", summary, what_they_do: what });
      onKit(r.kit);
      setEditing(false);
      setDirty(false);
      setMsg("Saved");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    if (!confirm("Regenerate the company brief? Your edits here will be replaced; other sections are untouched.")) return;
    setBusy(true);
    setMsg("Researching…");
    try {
      const r = await api.regenerate(id, "company_brief");
      onKit(r.kit);
      setSummary(r.kit.company_brief.summary);
      setWhat(r.kit.company_brief.what_they_do);
      setMsg("Brief regenerated");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-card animate-fade-in">
      <div className="mb-4 flex justify-between gap-2">
        <h2 className="font-semibold text-slate-900">Company brief</h2>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={save} disabled={busy || !dirty} className="btn-primary btn-sm">
                {busy ? "Saving…" : "Save"}
              </button>
              <button onClick={() => { setEditing(false); setSummary(kit.company_brief.summary); setWhat(kit.company_brief.what_they_do); setDirty(false); }} className="btn-secondary btn-sm">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="btn-secondary btn-sm">Edit</button>
              <button onClick={regenerate} disabled={busy} className="btn-secondary btn-sm">
                ↻ Regenerate
              </button>
            </>
          )}
        </div>
      </div>
      {editing ? (
        <div className="space-y-3">
          <textarea
            value={summary}
            onChange={(e) => { setSummary(e.target.value); setDirty(true); }}
            rows={5}
            className="input"
            aria-label="Company summary"
          />
          <textarea
            value={what}
            onChange={(e) => { setWhat(e.target.value); setDirty(true); }}
            rows={3}
            className="input"
            aria-label="What they do"
          />
        </div>
      ) : summary || what ? (
        <div className="space-y-3 text-sm leading-relaxed text-slate-700">
          <p>{summary}</p>
          <p><strong className="text-slate-900">What they do:</strong> {what}</p>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
          Nothing could be found about this company yet. Edit this brief by hand or try regenerating once retrieval improves.
        </p>
      )}
      {msg && <p aria-live="polite" className="mt-3 text-xs text-slate-500">{msg}</p>}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sources</h3>
        <ul className="mt-1.5 space-y-1 text-xs">
          {kit.company_brief.sources.length === 0 && <li className="text-slate-400">No sources could be retrieved.</li>}
          {kit.company_brief.sources.map((s) => (
            <li key={s}><a href={s} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">{s}</a></li>
          ))}
        </ul>
      </div>
    </section>
  );
}
