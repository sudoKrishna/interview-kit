import type { PipelineStep } from "@prepkit/shared";
import AppHeader from "@/components/AppHeader";

const ICON: Record<string, string> = {
  pending: "○", running: "◐", done: "●", skipped: "◌", failed: "✕",
};
const COLOR: Record<string, string> = {
  pending: "text-slate-300",
  running: "animate-pulse text-brand-600",
  done: "text-brand-600",
  skipped: "text-amber-500",
  failed: "text-red-600",
};

export default function ProgressView({ steps }: { steps: PipelineStep[] }) {
  const done = steps.filter((s) => s.status === "done" || s.status === "skipped").length;
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-xl px-4 pt-12 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Building your kit…</h1>
        <p className="mt-1.5 text-slate-500">
          Research runs several steps and can take a minute or two. This page updates live.
        </p>

        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-500"
            style={{ width: `${steps.length ? (done / steps.length) * 100 : 0}%` }}
          />
        </div>

        <ol className="surface-card mt-6 space-y-4" aria-live="polite">
          {steps.map((s) => (
            <li key={s.key} className="flex items-start gap-3">
              <span aria-hidden className={`mt-0.5 text-base ${COLOR[s.status]}`}>{ICON[s.status]}</span>
              <div>
                <p className="font-medium text-slate-800">{s.label}</p>
                {s.detail && <p className="text-xs text-slate-500">{s.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
