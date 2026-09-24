import { fetchPage } from "./fetcher";

export interface DiscussionResult {
  found: boolean;
  snippets: { url: string; text: string }[];
}

export interface SearchHit {
  url: string;
  title: string;
  snippet: string;
}

const SEARCH_MAX_RETRIES = 3;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";


export async function duckDuckGoSearch(
  query: string,
  opts: { allowPrivateUrls?: boolean; maxResults?: number; timeoutMs?: number } = {}
): Promise<SearchHit[]> {
  const { allowPrivateUrls = false, maxResults = 8, timeoutMs = 8000 } = opts;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  for (let attempt = 0; attempt <= SEARCH_MAX_RETRIES; attempt++) {
    const res = await fetchPage(url, { allowPrivateUrls, timeoutMs, maxBytes: 300 * 1024, userAgent: BROWSER_UA });
    const throttled = res.status === 202 || (res.ok && !res.body.includes("result__a") && !res.body.includes("no results"));
    if (res.ok && !throttled) {
      return parseDdgHtml(res.body).slice(0, maxResults);
    }
    if (attempt < SEARCH_MAX_RETRIES) {
      await sleep(Math.min(15_000, 1200 * 2 ** attempt + Math.floor(Math.random() * 400)));
      continue;
    }
  }
  return [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseDdgHtml(html: string): SearchHit[] {
  const out: SearchHit[] = [];
  const seen = new Set<string>();

  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 25) {
    const target = extractDdgTarget(m[1]);
    if (!target || seen.has(target)) continue;
    seen.add(target);
    const title = stripTags(m[2]);
    const tail = html.slice(m.index, m.index + 2500);
    const snippetMatch = tail.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
    const snippet = snippetMatch ? stripTags(snippetMatch[1]) : "";
    out.push({ url: target, title, snippet });
  }
  return out;
}

function extractDdgTarget(href: string): string | null {
  try {
    const decoded = href.startsWith("//") ? `https:${href}` : href;
    const u = new URL(decoded);
    const uddg = u.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    return decoded.startsWith("http") ? decoded : null;
  } catch {
    return null;
  }
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ").trim();
}

const DISCUSSION_SITES = ["glassdoor.com", "reddit.com", "medium.com", "news.ycombinator.com", "indeed.com", "levels.fyi", "teamblind.com", "quora.com", "stackoverflow.com", "leetcode.com/discuss"];

export async function searchCompanyInterviewDiscussion(
  companyName: string,
  opts: { allowPrivateUrls?: boolean } = {}
): Promise<DiscussionResult> {
  const queries = [
    `${companyName} interview process`,
    `${companyName} software engineer interview experience`,
  ];
  const snippets: { url: string; text: string }[] = [];
  const seen = new Set<string>();

  for (const q of queries) {
    await new Promise((r) => setTimeout(r, 400)); // be polite between queries
    let hits: SearchHit[] = [];
    try {
      hits = await duckDuckGoSearch(q, { allowPrivateUrls: opts.allowPrivateUrls });
    } catch {
      continue;
    }
    const relevant = hits.filter((h) => DISCUSSION_SITES.some((d) => h.url.toLowerCase().includes(d)));
    for (const h of relevant.slice(0, 3)) {
      if (seen.has(h.url)) continue;
      seen.add(h.url);
      snippets.push({ url: h.url, text: (h.snippet || h.title).slice(0, 600) });
    }
    if (snippets.length >= 4) break;
  }

  return { found: snippets.length > 0, snippets: snippets.slice(0, 5) };
}

const KNOWN_ATS_HOSTS = [
  "greenhouse.io",
  "boards.greenhouse.io",
  "job-boards.greenhouse.io",
  "jobs.lever.co",
  "myworkdayjobs.com",
  "ashbyhq.com",
  "smartrecruiters.com",
  "workable.com",
  "bamboohr.com",
  "icims.com",
  "jobvite.com",
  "breezy.hr",
];

export async function findCareersPageViaSearch(
  companyName: string,
  opts: { allowPrivateUrls?: boolean } = {}
): Promise<{ url: string; title: string } | null> {
  const queries = [`${companyName} careers`, `${companyName} jobs`];
  for (const q of queries) {
    await new Promise((r) => setTimeout(r, 400));
    let hits: SearchHit[] = [];
    try {
      hits = await duckDuckGoSearch(q, { allowPrivateUrls: opts.allowPrivateUrls });
    } catch {
      continue;
    }
    const atsHit = hits.find((h) => {
      const host = hostOf(h.url);
      return KNOWN_ATS_HOSTS.some((ats) => host === ats || host.endsWith(`.${ats}`));
    });
    if (atsHit) return { url: atsHit.url, title: atsHit.title };
  }
  return null;
}

function hostOf(u: string): string {
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return "";
  }
}
