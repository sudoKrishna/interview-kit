import { extractLinks, fetchPage, htmlToText } from "./fetcher";


const HIRING_KEYWORDS = [
  "careers", "jobs", "hiring", "join us", "join-us", "work with us",
  "work-with-us", "open roles", "openings", "vacancies", "we're hiring",
  "apply", "recruit", "talent", "handbook", "how we hire", "interview process",
];

const ABOUT_KEYWORDS = [
  "about", "who we are", "our story", "what we do", "mission", "product",
  "engineering blog", "blog", "team",
];

const NOISE = ["twitter.com", "facebook.com", "linkedin.com/posts", "instagram.com", "x.com", "mailto:", "tel:", ".pdf"];

export interface CrawledPage {
  url: string;
  text: string;
  purpose: "homepage" | "hiring" | "about";
  score: number;
}

export interface CrawlReport {
  pages: CrawledPage[];
  failures: { url: string; reason: string }[];
  hiringPageFound: boolean;
}

function scoreLink(url: string, text: string, keywords: string[]): number {
  const hay = `${url} ${text}`.toLowerCase();
  let score = 0;
  for (const kw of keywords) if (hay.includes(kw)) score += kw.split(" ").length * 2 + 2;
  if (NOISE.some((n) => url.toLowerCase().includes(n))) score = 0;
  return score;
}

export async function crawlCompanySite(
  companyUrl: string,
  opts: { maxPages?: number; allowPrivateUrls?: boolean; timeoutMs?: number } = {}
): Promise<CrawlReport> {
  const { maxPages = 6, allowPrivateUrls = true, timeoutMs = 10_000 } = opts;
  const report: CrawlReport = { pages: [], failures: [], hiringPageFound: false };

  // 1. fetch the homepage
  const home = await fetchPage(companyUrl, { allowPrivateUrls, timeoutMs });
  if (!home.ok) {
    report.failures.push({ url: companyUrl, reason: home.body });
    return report;
  }
  report.pages.push({
    url: home.finalUrl,
    text: htmlToText(home.body),
    purpose: "homepage",
    score: 0,
  });

  // 2. rank links: hiring candidates and about candidates
  const links = extractLinks(home.body, home.finalUrl);
  const origin = new URL(home.finalUrl).origin;
  const candidates = links
    .filter((l) => new URL(l.url).origin === origin) // stay on-site
    .map((l) => ({
      ...l,
      hiringScore: scoreLink(l.url, l.text, HIRING_KEYWORDS),
      aboutScore: scoreLink(l.url, l.text, ABOUT_KEYWORDS),
    }))
    .filter((l) => l.hiringScore > 0 || l.aboutScore > 0)
    .sort((a, b) => b.hiringScore - a.hiringScore || b.aboutScore - a.aboutScore);

  const seen = new Set([home.finalUrl]);
  const budget = maxPages - 1;

  // hiring pages first (highest score), then about pages, up to budget
  const toFetch = [
    ...sortBy(candidates.filter((c) => c.hiringScore > 0), (c) => c.hiringScore),
    ...sortBy(candidates.filter((c) => c.hiringScore === 0 && c.aboutScore > 0), (c) => c.aboutScore),
  ].slice(0, budget);

  for (const link of toFetch) {
    if (report.pages.length >= maxPages) break;
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    // simple rate limiting: small delay between requests
    await sleep(300);
    const res = await fetchPage(link.url, { allowPrivateUrls, timeoutMs });
    if (!res.ok) {
      report.failures.push({ url: link.url, reason: res.body });
      continue;
    }
    const purpose: "hiring" | "about" = link.hiringScore > 0 ? "hiring" : "about";
    report.pages.push({
      url: res.finalUrl,
      text: htmlToText(res.body),
      purpose,
      score: link.hiringScore || link.aboutScore,
    });
    if (purpose === "hiring") report.hiringPageFound = true;
  }

  return report;
}

function sortBy<T>(arr: T[], key: (t: T) => number): T[] {
  return [...arr].sort((a, b) => key(b) - key(a));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
