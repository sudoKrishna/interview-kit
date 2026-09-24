import { fetchPage, htmlToText } from "./fetcher";


export interface DiscussionResult {
  found: boolean;
  snippets: { url: string; text: string }[];
}

export async function searchCompanyInterviewDiscussion(
  companyName: string,
  opts: { allowPrivateUrls?: boolean } = {}
): Promise<DiscussionResult> {
  const queries = [
    `${companyName} interview process`,
    `${companyName} software engineer interview experience`,
  ];
  const snippets: { url: string; text: string }[] = [];

  for (const q of queries) {
    await new Promise((r) => setTimeout(r, 400)); // be polite
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    const res = await fetchPage(url, { allowPrivateUrls: false, timeoutMs: 8000, maxBytes: 200 * 1024 });
    if (!res.ok) continue;
    const text = htmlToText(res.body);
    const results = parseDdgResults(text).slice(0, 3);
    for (const r of results) {
      snippets.push({ url: r.url, text: r.text.slice(0, 600) });
    }
    if (snippets.length >= 4) break;
  }

  return { found: snippets.length > 0, snippets: snippets.slice(0, 5) };
}

function parseDdgResults(text: string): { url: string; text: string }[] {

  const out: { url: string; text: string }[] = [];
  const wanted = ["glassdoor", "reddit", "medium.com", "news.ycombinator.com", "indeed", "levels", "blind", "quora", "stackoverflow"];
  const re = /https?:\/\/[^\s"'<>]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && out.length < 10) {
    const u = m[0].replace(/[.,)]+$/, "");
    if (wanted.some((w) => u.toLowerCase().includes(w))) {
      out.push({ url: u, text: text.slice(m.index, m.index + 600).replace(/\s+/g, " ") });
    }
  }
  return out;
}
