import { crawlCompanySite, CrawlReport } from "../services/crawler";
import { searchCompanyInterviewDiscussion, DiscussionResult } from "../services/search";

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
