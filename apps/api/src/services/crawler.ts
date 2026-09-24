import { extractLinks, fetchPage, htmlToText } from "./fetcher";

const HIRING_KEYWORDS = [
  "careers", "jobs", "hiring", "join us", "join-us", "work with us",
  "work-with-us", "open roles", "openings", "vacancies", "we're hiring",
  "apply", "recruit", "talent", "handbook", "how we hire", "interview process",
  "interview-process", "our process", "life at", "engineering culture",
];

const ABOUT_KEYWORDS = [
  "about", "who we are", "our story", "what we do", "mission", "product",
  "engineering blog", "blog", "team", "culture", "values",
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

function rankCandidates(links: { url: string; text: string }[], origin: string, seen: Set<string>) {
  return links
    .filter((l) => {
      try {
        return new URL(l.url).origin === origin && !seen.has(l.url);
      } catch {
        return false;
      }
    })
    .map((l) => ({
      ...l,
      hiringScore: scoreLink(l.url, l.text, HIRING_KEYWORDS),
      aboutScore: scoreLink(l.url, l.text, ABOUT_KEYWORDS),
    }))
    .filter((l) => l.hiringScore > 0 || l.aboutScore > 0)
    .sort((a, b) => b.hiringScore - a.hiringScore || b.aboutScore - a.aboutScore);
}

export async function crawlCompanySite(
  companyUrl: string,
  opts: { maxPages?: number; allowPrivateUrls?: boolean; timeoutMs?: number; maxDepth?: number } = {}
): Promise<CrawlReport> {
  const { maxPages = 8, allowPrivateUrls = true, timeoutMs = 10_000, maxDepth = 2 } = opts;
  const report: CrawlReport = { pages: [], failures: [], hiringPageFound: false };

  // depth 0: homepage
  const home = await fetchPage(companyUrl, { allowPrivateUrls, timeoutMs });
  if (!home.ok) {
    report.failures.push({ url: companyUrl, reason: home.body });
    return report;
  }
  report.pages.push({ url: home.finalUrl, text: htmlToText(home.body), purpose: "homepage", score: 0 });

  const origin = new URL(home.finalUrl).origin;
  const seen = new Set([home.finalUrl]);
  let frontierHtml: { html: string; url: string }[] = [{ html: home.body, url: home.finalUrl }];

  for (let depth = 1; depth <= maxDepth && report.pages.length < maxPages; depth++) {
    // depth 2+ is only worth the budget if depth 1 didn't already land a hiring page
    if (depth > 1 && report.hiringPageFound) break;

    const candidates = frontierHtml
      .flatMap(({ html, url }) => rankCandidates(extractLinks(html, url), origin, seen))
      .sort((a, b) => b.hiringScore - a.hiringScore || b.aboutScore - a.aboutScore);

    const toFetch = [
      ...candidates.filter((c) => c.hiringScore > 0),
      ...candidates.filter((c) => c.hiringScore === 0 && c.aboutScore > 0),
    ].slice(0, Math.max(0, maxPages - report.pages.length));

    const nextFrontier: { html: string; url: string }[] = [];
    for (const link of toFetch) {
      if (report.pages.length >= maxPages) break;
      if (seen.has(link.url)) continue;
      seen.add(link.url);
      await sleep(300); // simple rate limiting between requests
      const res = await fetchPage(link.url, { allowPrivateUrls, timeoutMs });
      if (!res.ok) {
        report.failures.push({ url: link.url, reason: res.body });
        continue;
      }
      const purpose: "hiring" | "about" = link.hiringScore > 0 ? "hiring" : "about";
      report.pages.push({ url: res.finalUrl, text: htmlToText(res.body), purpose, score: link.hiringScore || link.aboutScore });
      if (purpose === "hiring") report.hiringPageFound = true;
      nextFrontier.push({ html: res.body, url: res.finalUrl });
    }
    frontierHtml = nextFrontier;
    if (frontierHtml.length === 0) break;
  }

  return report;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
