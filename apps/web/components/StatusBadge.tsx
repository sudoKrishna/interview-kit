export default function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    generating: "pill-amber",
    ready: "pill-brand",
    failed: "pill-red",
  };
  return (
    <span className={styles[status] ?? "pill-neutral"}>
      {status === "generating" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-600" />}
      {status}
    </span>
  );
}
