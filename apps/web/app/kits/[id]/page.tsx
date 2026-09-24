"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { Kit, PipelineStep } from "@prepkit/shared";
import { api } from "@/lib/api";
import AppHeader from "@/components/AppHeader";
import ProgressView from "@/components/ProgressView";
import TabNav, { type Tab } from "@/components/TabNav";
import BriefPanel from "@/components/BriefPanel";
import RolePanel from "@/components/RolePanel";
import QuestionList from "@/components/QuestionList";
import FlashcardList from "@/components/FlashcardList";
import SchedulePanel from "@/components/SchedulePanel";
import PracticePanel from "@/components/PracticePanel";

const pageMotion = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } } as const;

export default function KitPage() {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<string>("generating");
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [kit, setKit] = useState<Kit | null>(null);
  const [practice, setPractice] = useState<Record<string, { confidence: number; lastSeen: string }>>({});
  const [tab, setTab] = useState<Tab>("brief");

  const load = useCallback(async () => {
    try {
      if (status === "generating") {
        const p = await api.getProgress(id);
        setStatus(p.status);
        setSteps(p.steps);
        setError(p.error?.message ?? null);
        if (p.status !== "generating") {
          const full = await api.getKit(id);
          setKit(full.kit);
          setPractice(full.practice ?? {});
        }
      }
    } catch (e: any) {
      setError(e.message);
    }
  }, [id, status]);

  useEffect(() => {
    api.getKit(id).then((r) => {
      setStatus(r.status);
      setKit(r.kit);
      setPractice(r.practice ?? {});
      setError(r.error?.message ?? null);
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (status !== "generating") return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [status, load]);

  if (status === "generating") return <ProgressView steps={steps} />;

  if (status === "failed" || !kit) {
    return <div className="dark-app min-h-screen"><AppHeader /><main className="mx-auto max-w-2xl px-4 pt-12 sm:px-6"><h1 className="mb-4 text-2xl font-semibold tracking-tight text-slate-100">Generation failed</h1><p role="alert" className="rounded-2xl bg-red-950/60 p-4 text-red-200">{error ?? "Unknown error"}</p><Link href="/" className="mt-6 inline-block text-sm font-medium text-lime-300 hover:text-lime-200">← Back to your kits</Link></main></div>;
  }

  const uncovered = kit.coverage.uncovered_requirement_ids.length;
  const panel = tab === "brief" ? <BriefPanel kit={kit} onKit={setKit} id={id} /> : tab === "role" ? <RolePanel kit={kit} /> : tab === "questions" ? <QuestionList kit={kit} id={id} onKit={setKit} /> : tab === "flashcards" ? <FlashcardList kit={kit} id={id} onKit={setKit} /> : tab === "schedule" ? <SchedulePanel kit={kit} id={id} onKit={setKit} /> : <PracticePanel kit={kit} id={id} initialPractice={practice} />;

  return (
    <div className="dark-app min-h-screen pb-24">
      <AppHeader right={<Link href="/" className="kit-back-link">← All kits</Link>} />
      <main className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 sm:pt-14">
        <motion.div {...pageMotion}>
          <div className="kit-heading-row">
            <div>
              <p className="kit-eyebrow">Your preparation space</p>
              <h1 className="kit-title mt-3">{kit.source.role} <span>@</span> {kit.source.company}</h1>
            </div>
            <div className="kit-ready-mark"><i /> kit ready</div>
          </div>
          <div className="kit-meta mb-8 mt-5 flex flex-wrap items-center gap-3 text-sm">
            <span>{kit.schedule.days_available}-day plan</span><b>·</b><span>{kit.questions.length} questions</span><b>·</b><span className={uncovered === 0 ? "kit-success" : "kit-warning"}>{uncovered === 0 ? "all must-haves covered" : `${uncovered} must-have(s) uncovered`}</span>
          </div>
          <div className="kit-tab-shell"><TabNav tab={tab} onChange={setTab} badgeCount={{ questions: kit.questions.length, flashcards: kit.flashcards.length }} /></div>
          <div className="mt-6"><AnimatePresence mode="wait" initial={false}><motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .25, ease: "easeOut" }}>{panel}</motion.div></AnimatePresence></div>
        </motion.div>
      </main>
    </div>
  );
}
