export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-700">
        Scaffold ready
      </span>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Interview Prep Kit
      </h1>
      <p className="max-w-xl text-lg text-slate-600">
        Paste a job description and a company URL, and get a researched,
        structured preparation kit you can edit and practise against.
      </p>
    </main>
  );
}
