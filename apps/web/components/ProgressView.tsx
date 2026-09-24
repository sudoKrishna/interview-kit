"use client";
import { motion } from "framer-motion";
import type { PipelineStep } from "@prepkit/shared";
import AppHeader from "@/components/AppHeader";

const ICON: Record<string, string> = { pending: "○", running: "◐", done: "●", skipped: "◌", failed: "✕" };
const COLOR: Record<string, string> = { pending: "text-slate-500", running: "animate-pulse text-lime-300", done: "text-lime-300", skipped: "text-amber-300", failed: "text-red-300" };

export default function ProgressView({ steps }: { steps: PipelineStep[] }) {
  const done = steps.filter((s) => s.status === "done" || s.status === "skipped").length;
  return (
    <div className="dark-app min-h-screen">
      <AppHeader />
      <motion.main className="mx-auto max-w-xl px-4 pt-16 sm:px-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45 }}>
        <p className="kit-eyebrow">Prep is thinking</p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight text-slate-100">Building your kit<span className="loading-dots">...</span></h1>
        <p className="mt-3 text-slate-500">Research runs several steps and can take a minute or two. This page updates live.</p>
        <div className="mt-8 h-1 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-lime-300" initial={{ width: 0 }} animate={{ width: `${steps.length ? (done / steps.length) * 100 : 4}%` }} transition={{ duration: .5 }} /></div>
        <motion.ol className="surface-card mt-6 space-y-4" aria-live="polite" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .15 }}>
          {steps.map((s) => <li key={s.key} className="flex items-start gap-3"><span aria-hidden className={`mt-0.5 text-base ${COLOR[s.status]}`}>{ICON[s.status]}</span><div><p className="font-medium text-slate-200">{s.label}</p>{s.detail && <p className="text-xs text-slate-500">{s.detail}</p>}</div></li>)}
        </motion.ol>
      </motion.main>
    </div>
  );
}
