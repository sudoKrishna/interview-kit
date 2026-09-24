"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.register(email, password);
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="mb-8 flex items-baseline gap-2.5">
        <span className="text-2xl font-semibold tracking-tight text-brand-700">prep</span>
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
          AI Interview Prep
        </span>
      </div>
      <form onSubmit={submit} className="w-full max-w-sm animate-fade-in space-y-4 surface-card">
        <div>
          <h1 className="text-lg font-semibold">Create an account</h1>
          <p className="mt-0.5 text-sm text-slate-500">Takes ten seconds, no email verification needed.</p>
        </div>
        <label className="field-label">
          Email
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="input" autoComplete="email" placeholder="you@company.com"
          />
        </label>
        <label className="field-label">
          Password (min 8 chars)
          <input
            type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
            className="input" autoComplete="new-password" placeholder="••••••••"
          />
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Creating…" : "Register"}
        </button>
        <p className="text-center text-sm text-slate-500">
          Already have an account?{" "}
          <a href="/login" className="font-medium text-brand-700 hover:text-brand-800">Sign in</a>
        </p>
      </form>
    </main>
  );
}
