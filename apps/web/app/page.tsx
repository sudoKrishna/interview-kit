"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";
import MinimalHero from "@/components/MinimalHero";

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
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load, router]);

  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [kits]);

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
    <div className="dark-app min-h-screen overflow-hidden text-slate-100">
      <AppHeader
        right={
          <button onClick={async () => { await api.logout(); router.push("/login"); }} className="hero-nav-button">
            Log out <span aria-hidden>↗</span>
          </button>
        }
      />

      <main>
        <MinimalHero />

        <section className="story-section mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28" data-reveal>
          <div className="grid gap-10 md:grid-cols-[1fr_1.35fr] md:gap-20">
            <div><p className="section-kicker">The idea</p><h2 className="story-heading mt-4">Less noise.<br /><span>More signal.</span></h2></div>
            <div className="story-body"><p>Great preparation isn&apos;t about collecting more tabs. It&apos;s about knowing what matters, understanding the room you&apos;re walking into, and making time for the work that will actually move you forward.</p><p>Prep brings the research, questions, and practice plan together in one focused space.</p></div>
          </div>
          <div className="principle-grid mt-16 grid gap-4 sm:grid-cols-3 sm:gap-5">
            <article className="principle-card"><span>01</span><h3>Context first</h3><p>We read between the lines of the role and the company.</p></article>
            <article className="principle-card"><span>02</span><h3>Signal over volume</h3><p>Every question connects back to a real requirement.</p></article>
            <article className="principle-card"><span>03</span><h3>Progress you can feel</h3><p>A focused plan turns uncertainty into momentum.</p></article>
          </div>
        </section>

        <div id="new-kit" className="mx-auto max-w-4xl scroll-mt-8 px-4 pb-20 sm:px-6 sm:pb-28">
          <div className="mb-8 flex items-end justify-between gap-4" data-reveal>
            <div><p className="section-kicker">Start here</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Build a new prep kit</h2><p className="mt-2 text-slate-500">Give us the role. We&apos;ll give you a plan.</p></div>
            <span className="kit-count">{kits?.length ?? 0} kit{kits?.length === 1 ? "" : "s"}</span>
          </div>

          <div className="surface-card mb-12 animate-fade-in" id="kit-form" data-reveal>
            <div className="mb-5 flex items-center gap-1.5 rounded-xl bg-slate-100 p-1 text-sm"><motion.button whileTap={{ scale: .97 }} onClick={() => setMode("single")} className={`relative flex-1 overflow-hidden rounded-lg px-3 py-1.5 font-medium transition-colors ${mode === "single" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{mode === "single" && <motion.span layoutId="dashboard-mode-pill" className="absolute inset-0 rounded-lg bg-white" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}<span className="relative z-[1]">New kit</span></motion.button><motion.button whileTap={{ scale: .97 }} onClick={() => setMode("batch")} className={`relative flex-1 overflow-hidden rounded-lg px-3 py-1.5 font-medium transition-colors ${mode === "batch" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{mode === "batch" && <motion.span layoutId="dashboard-mode-pill" className="absolute inset-0 rounded-lg bg-white" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}<span className="relative z-[1]">Batch upload</span></motion.button></div>
            {mode === "single" ? <form onSubmit={createKit} className="space-y-4"><label className="field-label">Job description<textarea required value={jd} onChange={(e) => setJd(e.target.value)} rows={6} placeholder="Paste the full job description here…" className="input font-mono text-xs" /></label><div className="flex flex-col gap-4 sm:flex-row"><label className="field-label flex-1">Company website<input required type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://company.com" className="input" /></label><label className="field-label sm:w-40">Days until interview<input type="number" min={1} max={60} value={days} onChange={(e) => setDays(Number(e.target.value))} className="input" /></label></div>{error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}<button type="submit" disabled={busy} className="btn-primary">{busy ? "Working…" : "Generate kit"}</button></form> : <div className="space-y-4"><p className="text-sm text-slate-500">Upload a JSON file of <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{`{ jd, company_url, days }`}</code> objects to prepare for several roles at once.</p><label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40"><span className="text-sm font-medium text-slate-700">Click to choose a JSON file</span><span className="text-xs text-slate-400">or drop it here</span><input type="file" accept="application/json" onChange={uploadBatch} className="hidden" /></label>{error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}{busy && <p className="text-sm text-slate-500">Uploading cases…</p>}{batchResults && <ul aria-live="polite" className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">{batchResults.map((r) => <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm"><span className="font-medium text-slate-700">case {r.id}</span><span className={r.ok ? "pill-brand" : "pill-red"}>{r.ok ? "ok" : "failed"} · {r.detail}</span></li>)}</ul>}</div>}
          </div>

          {kits === null ? <ul className="space-y-3"><li className="surface-flat h-[68px] animate-pulse" /><li className="surface-flat h-[68px] animate-pulse" /></ul> : kits.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-10 text-center text-slate-500">No kits yet. Paste a job description above to build your first one.</div> : <><div className="mb-4 flex items-center justify-between"><p className="section-kicker">Your workspace</p><span className="text-xs text-slate-400">Updated automatically</span></div><ul className="space-y-3">{kits.map((k) => <li key={k.id}><Link href={`/kits/${k.id}`} className="group flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/5 bg-white/90 p-4 shadow-softer transition-all hover:-translate-y-0.5 hover:shadow-soft"><div><p className="font-medium text-slate-900 group-hover:text-brand-700">{k.role ?? "Preparing…"} <span className="text-slate-400">@</span> {k.company}</p><p className="mt-0.5 text-sm text-slate-500">{k.days} days · {new Date(k.createdAt).toLocaleDateString()}{k.error ? ` · ${k.error.message}` : ""}</p></div><StatusBadge status={k.status} /></Link></li>)}</ul></>}
        </div>
      </main>

      <footer className="site-footer">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="footer-top"><div><Link href="/" className="footer-logo">prep<span>.</span></Link><p className="footer-tagline">A quieter way to get ready<br />for what&apos;s next.</p></div><div className="footer-award"><span className="award-mark">✦</span><div><strong>Independent design</strong><p>Made with care for ambitious people.</p></div></div></div>
          <div className="footer-rule" />
          <div className="footer-bottom"><p>© {new Date().getFullYear()} Prep. Built for the next conversation.</p><nav aria-label="Footer navigation"><a href="#new-kit">Build a kit</a><a href="#kit-form">How it works</a><a href="mailto:hello@prepkit.app">About</a></nav><span className="footer-status"><span className="status-dot" /> All systems considered</span></div>
        </div>
      </footer>
    </div>
  );
}
