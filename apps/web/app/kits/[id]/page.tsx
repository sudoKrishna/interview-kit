"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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

  if (status === "generating") {
    return <ProgressView steps={steps} />;
  }
  if (status === "failed" || !kit) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-2xl px-4 pt-12 sm:px-6">
          <h1 className="mb-4 text-2xl font-semibold tracking-tight">Generation failed</h1>
          <p role="alert" className="rounded-2xl bg-red-50 p-4 text-red-700">{error ?? "Unknown error"}</p>
          <Link href="/" className="mt-6 inline-block text-sm font-medium text-brand-700 hover:text-brand-800">← Back to your kits</Link>
        </main>
      </div>
    );
  }

  const uncovered = kit.coverage.uncovered_requirement_ids.length;

  return (
    <div className="min-h-screen pb-24">
      <AppHeader right={<Link href="/" className="btn-ghost btn-sm">← All kits</Link>} />
      <main className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {kit.source.role} <span className="text-slate-400">@</span> {kit.source.company}
        </h1>
        <div className="mb-6 mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span>{kit.schedule.days_available}-day plan</span>
          <span className="text-slate-300">·</span>
          <span>{kit.questions.length} questions</span>
          <span className="text-slate-300">·</span>
          <span className={uncovered === 0 ? "font-medium text-brand-700" : "font-medium text-amber-700"}>
            {uncovered === 0 ? "all must-haves covered" : `${uncovered} must-have(s) uncovered`}
          </span>
        </div>
        <TabNav tab={tab} onChange={setTab} badgeCount={{ questions: kit.questions.length, flashcards: kit.flashcards.length }} />
        <div className="mt-6">
          {tab === "brief" && <BriefPanel kit={kit} onKit={setKit} id={id} />}
          {tab === "role" && <RolePanel kit={kit} />}
          {tab === "questions" && <QuestionList kit={kit} id={id} onKit={setKit} />}
          {tab === "flashcards" && <FlashcardList kit={kit} id={id} onKit={setKit} />}
          {tab === "schedule" && <SchedulePanel kit={kit} id={id} onKit={setKit} />}
          {tab === "practice" && <PracticePanel kit={kit} id={id} initialPractice={practice} />}
        </div>
      </main>
    </div>
  );
}
