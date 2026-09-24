"use client";
import Link from "next/link";

export default function AppHeader({
  right,
  subtitle = "AI INTERVIEW PREP",
}: {
  right?: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-black/5 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2.5">
          <span className="text-xl font-semibold tracking-tight text-brand-700">prep</span>
          <span className="hidden text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 sm:inline">
            {subtitle}
          </span>
        </Link>
        {right}
      </div>
    </header>
  );
}
