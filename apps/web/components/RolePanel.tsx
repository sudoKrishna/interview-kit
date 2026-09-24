import type { Kit } from "@prepkit/shared";

const KIND_PILL: Record<string, string> = {
  technical: "pill-brand",
  behavioural: "pill-amber",
  domain: "pill-sky",
};

export default function RolePanel({ kit }: { kit: Kit }) {
  const musts = kit.role.requirements.filter((r) => r.priority === "must");
  const nices = kit.role.requirements.filter((r) => r.priority === "nice");

  return (
    <section className="animate-fade-in space-y-6">
      <div className="surface-card">
        <h2 className="font-semibold text-slate-900">
          {kit.role.title} <span className="text-slate-400">·</span> <span className="font-normal text-slate-500">{kit.role.seniority}</span>
        </h2>
        <p className="mt-1 text-sm text-slate-500">{kit.source.location}</p>

        <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Responsibilities</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
          {kit.role.responsibilities.length === 0 && <li className="list-none text-slate-400">None extracted — thin description.</li>}
          {kit.role.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </div>

      <div className="surface-card">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Must-have requirements</h3>
        <ul className="mt-3 space-y-2.5">
          {musts.length === 0 && <li className="text-sm text-slate-400">None extracted.</li>}
          {musts.map((r) => (
            <li key={r.id} className="flex items-start gap-2.5 text-sm text-slate-700">
              <span className={`mt-0.5 ${KIND_PILL[r.kind] ?? "pill-neutral"}`}>{r.kind}</span>
              <span>{r.text} <span className="text-slate-400">({r.id})</span></span>
            </li>
          ))}
        </ul>

        {nices.length > 0 && (
          <>
            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">Nice to have</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
              {nices.map((r) => (
                <li key={r.id}>
                  <span className="text-slate-400">({r.id})</span> {r.text}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
