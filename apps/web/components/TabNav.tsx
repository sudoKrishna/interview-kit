"use client";

import { motion } from "framer-motion";

export type Tab = "brief" | "role" | "questions" | "flashcards" | "schedule" | "practice";

const TABS: { key: Tab; label: string }[] = [
  { key: "brief", label: "Company" },
  { key: "role", label: "Role" },
  { key: "questions", label: "Questions" },
  { key: "flashcards", label: "Flashcards" },
  { key: "schedule", label: "Schedule" },
  { key: "practice", label: "Practice" },
];

export default function TabNav({
  tab,
  onChange,
  badgeCount,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  badgeCount?: { questions: number; flashcards: number };
}) {
  return (
    <nav aria-label="Kit sections" className="-mx-1 overflow-x-auto pb-1">
      <ul className="flex min-w-max gap-2 px-1">
        {TABS.map((t) => {
          const active = tab === t.key;
          const badge = t.key === "questions" ? badgeCount?.questions : t.key === "flashcards" ? badgeCount?.flashcards : undefined;
          return (
            <li key={t.key}>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => onChange(t.key)}
                aria-current={active ? "page" : undefined}
                className={`${active ? "tab-btn-active" : "tab-btn-idle"} relative overflow-hidden`}
              >
                <span className="relative z-[1]">{t.label}</span>
                {badge !== undefined && badge > 0 && <span className="tab-badge relative z-[1] ml-1.5 px-1.5 py-0.5 text-xs">{badge}</span>}
              </motion.button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
