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
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-logo" aria-label="Prep home">prep<span>.</span></Link>
        <span className="site-subtitle">{subtitle}</span>
        {right}
      </div>
    </header>
  );
}
