"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";

interface KitSummary {
  id: string;
  status: "generating" | "ready" | "failed";
  company: string;
  role: string | null;
  days: number;
  error: { code: string; message: string } | null;
  createdAt: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [kits, setKits] = useState<KitSummary[] | null>(null);
  const [jd, setJd] = useState("");
  const [url, setUrl] = useState("");
  const [days, setDays] = useState(7);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [batchResults, setBatchResults] = useState<{ id: string | number; ok: boolean; detail: string }[] | null>(null);

  const load = useCallback(async () => {
    try {
      const { kits } = await api.listKits();
      setKits(kits);
    } catch (e: any) {
      if (e.status === 401) router.push("/login");
      else setError(e.message);
    }
  }, [router]);

  useEffect(() => {
    api.me().catch(() => router.push("/login"));
    load();
    const t = setInterval(load, 4000); // poll while a kit is generating
    return () => clearInterval(t);
  }, [load, router]);

  async function createKit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createKit(jd, url, days);
      setJd("");
      setUrl("");
      load();
    } catch (e: any) {
      if (e.code === "DUPLICATE_KIT" && e.kitId) router.push(`/kits/${e.kitId}`);
      else setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadBatch(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBatchResults(null);
    setBusy(true);
    try {
      const cases = JSON.parse(await file.text());
      const results: { id: string | number; ok: boolean; detail: string }[] = [];
      for (const [i, c] of cases.entries()) {
        const caseId = c.id ?? i + 1;
        try {
          await api.createKit(c.jd, c.company_url, c.days ?? 7);
          results.push({ id: caseId, ok: true, detail: "kit created" });
        } catch (err: any) {
          // one case failing must not abort the rest — but it must be reported, not swallowed
          results.push({ id: caseId, ok: false, detail: err.code === "DUPLICATE_KIT" ? "already exists" : err.message ?? "failed" });
        }
      }
      setBatchResults(results);
      load();
    } catch (err: any) {
      setError(`Could not read file: ${err.message}`);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="min-h-screen pb-24">
      <AppHeader
        right={
          <button onClick={async () => { await api.logout(); router.push("/login"); }} className="btn-ghost btn-sm">
            Log out
          </button>
        }
      />

      <main className="mx-auto max-w-4xl px-4 pt-10 sm:px-6">
        <div className="mb-8">
          <p className="pill-brand mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-600" /> {kits?.length ?? 0} kit{kits?.length === 1 ? "" : "s"}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Your prep kits</h1>
          <p className="mt-1.5 text-slate-500">
            Paste a job description and a company site — the research and question bank build themselves.
          </p>
        </div>

        <div className="surface-card mb-10 animate-fade-in">
          <div className="mb-5 flex items-center gap-1.5 rounded-xl bg-slate-100 p-1 text-sm">
            <button
              onClick={() => setMode("single")}
              className={`flex-1 rounded-lg px-3 py-1.5 font-medium transition-colors ${mode === "single" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              New kit
            </button>
            <button
              onClick={() => setMode("batch")}
              className={`flex-1 rounded-lg px-3 py-1.5 font-medium transition-colors ${mode === "batch" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Batch upload
            </button>
          </div>

          {mode === "single" ? (
            <form onSubmit={createKit} className="space-y-4">
              <label className="field-label">
                Job description
                <textarea
                  required value={jd} onChange={(e) => setJd(e.target.value)} rows={6}
                  placeholder="Paste the full job description here…"
                  className="input font-mono text-xs"
                />
              </label>
              <div className="flex flex-col gap-4 sm:flex-row">
                <label className="field-label flex-1">
                  Company website
                  <input
                    required type="text" value={url} onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://company.com"
                    className="input"
                  />
                </label>
                <label className="field-label sm:w-40">
                  Days until interview
                  <input
                    type="number" min={1} max={60} value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="input"
                  />
                </label>
              </div>
              {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={busy} className="btn-primary">
                {busy ? "Working…" : "Generate kit"}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Upload a JSON file of <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{`{ jd, company_url, days }`}</code> objects
                to prepare for several roles at once. One failing case won&apos;t stop the rest.
              </p>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40">
                <span className="text-sm font-medium text-slate-700">Click to choose a JSON file</span>
                <span className="text-xs text-slate-400">or drop it here</span>
                <input type="file" accept="application/json" onChange={uploadBatch} className="hidden" />
              </label>
              {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              {busy && <p className="text-sm text-slate-500">Uploading cases…</p>}
              {batchResults && (
                <ul aria-live="polite" className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                  {batchResults.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="font-medium text-slate-700">case {r.id}</span>
                      <span className={r.ok ? "pill-brand" : "pill-red"}>{r.ok ? "ok" : "failed"} · {r.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {kits === null ? (
          <ul className="space-y-3">
            {[0, 1].map((i) => (
              <li key={i} className="surface-flat h-[68px] animate-pulse" />
            ))}
          </ul>
        ) : kits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-10 text-center text-slate-500">
            No kits yet. Paste a job description above to build your first one.
          </div>
        ) : (
          <ul className="space-y-3">
            {kits.map((k) => (
              <li key={k.id}>
                <Link
                  href={`/kits/${k.id}`}
                  className="group flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/5 bg-white/90 p-4 shadow-softer transition-all hover:-translate-y-0.5 hover:shadow-soft"
                >
                  <div>
                    <p className="font-medium text-slate-900 group-hover:text-brand-700">
                      {k.role ?? "Preparing…"} <span className="text-slate-400">@</span> {k.company}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {k.days} days · {new Date(k.createdAt).toLocaleDateString()}
                      {k.error ? ` · ${k.error.message}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={k.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
