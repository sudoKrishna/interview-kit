import { crawlCompanySite, CrawlReport } from "../services/crawler";
import { fetchPage, htmlToText } from "../services/fetcher";
import { searchCompanyInterviewDiscussion, findCareersPageViaSearch, DiscussionResult } from "../services/search";

export interface CompanyResearch {
  crawl: CrawlReport;
  discussion: DiscussionResult | null;
}

export async function researchCompany(
  companyUrl: string,
  companyName: string,
  opts: { allowPrivateUrls: boolean; maxPages: number }
): Promise<CompanyResearch> {
  const crawl = await crawlCompanySite(companyUrl, {
    allowPrivateUrls: opts.allowPrivateUrls,
    maxPages: opts.maxPages,
  });

  if (!crawl.hiringPageFound) {
    try {
      const ats = await findCareersPageViaSearch(companyName, { allowPrivateUrls: opts.allowPrivateUrls });
      if (ats) {
        const res = await fetchPage(ats.url, { allowPrivateUrls: opts.allowPrivateUrls, timeoutMs: 10_000 });
        if (res.ok) {
          crawl.pages.push({ url: res.finalUrl, text: htmlToText(res.body), purpose: "hiring", score: 1 });
          crawl.hiringPageFound = true;
        } else {
          crawl.failures.push({ url: ats.url, reason: `found via search but could not fetch: ${res.body}` });
        }
      }
    } catch (e: any) {
      crawl.failures.push({ url: "search:careers", reason: String(e?.message ?? e) });
    }
  }

  let discussion: DiscussionResult | null = null;
  try {
    discussion = await searchCompanyInterviewDiscussion(companyName, {
      allowPrivateUrls: opts.allowPrivateUrls,
    });
  } catch {
    discussion = null;
  }

  return { crawl, discussion };
}
