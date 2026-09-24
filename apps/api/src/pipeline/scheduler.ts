import type { Question, ScheduleDay } from "@prepkit/shared";



const MINUTES_PER_QUESTION = 15;

export function allocateSchedule(
  questions: Question[],
  daysAvailable: number,
  requirements: { id: string; priority: "must" | "nice" }[]
): { days: ScheduleDay[]; unplacedQuestionIds: string[] } {
  const days = Math.max(1, Math.floor(daysAvailable));
  const mustIds = new Set(
    requirements.filter((r) => r.priority === "must").map((r) => r.id)
  );

 
  const weight = (q: Question) =>
    (q.requirement_ids.some((id) => mustIds.has(id)) ? 100 : 0) +
    (4 - q.difficulty) * 10; // difficulty 3 => 10, difficulty 1 => 30

  const sorted = [...questions].sort((a, b) => weight(b) - weight(a));

  const buckets: Question[][] = Array.from({ length: days }, () => []);
  const perDay = Math.max(1, Math.ceil(sorted.length / days));

  const fillDays = days === 1 ? 1 : days - 1;

  let cursor = 0;
  for (let d = 0; d < fillDays && cursor < sorted.length; d++) {
    buckets[d] = sorted.slice(cursor, cursor + perDay);
    cursor += perDay;
  }

  const remaining = sorted.slice(cursor);
  if (days === 1) {
    buckets[0] = [...buckets[0], ...remaining];
  } else {
   
    const reviewBucket = buckets[days - 1];
    reviewBucket.push(...remaining);
    const fit = buckets.flatMap((b, i) =>
      i < days - 1 ? b.filter((q) => q.category === "company-fit") : []
    );
    for (let i = 0; i < buckets.length - 1; i++) {
      buckets[i] = buckets[i].filter((q) => q.category !== "company-fit");
    }
    reviewBucket.unshift(...fit);
  }

  const scheduleDays: ScheduleDay[] = buckets.map((qs, i) => {
    const companyFit = qs.some((q) => q.category === "company-fit");
    const isLast = i === days - 1;
    const focus = isLast && days > 1
      ? `Review, weak spots and company-fit preparation`
      : companyFit
        ? `Company knowledge and fit`
        : focusFor(qs);
    const minutes = Math.max(30, Math.round((qs.length * MINUTES_PER_QUESTION) / 5) * 5);
    return {
      day: i + 1,
      focus,
      question_ids: qs.map((q) => q.id),
      minutes,
    };
  });

  const placed = new Set<string>();
  for (const d of scheduleDays) for (const id of d.question_ids) placed.add(id);
  const unplacedQuestionIds = questions
    .filter((q) => !placed.has(q.id))
    .map((q) => q.id);

  return { days: scheduleDays, unplacedQuestionIds };
}

function focusFor(qs: Question[]): string {
  if (qs.length === 0) return "Lighter day — consolidation and rest";
  const cats = [...new Set(qs.map((q) => q.category))];
  const label = cats
    .map((c) => c.replace("-", " ").replace(/\b\w/g, (m) => m.toUpperCase()))
    .join(" and ");
  return label;
}
