import { URL } from "url";
import dns from "dns/promises";
import net from "net";

export interface FetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  allowPrivateUrls?: boolean; 
}

export interface FetchResult {
  ok: boolean;
  status: number;
  finalUrl: string;
  contentType: string;
  body: string; 
}

export class FetchError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function assertPublicUrl(rawUrl: string, allowPrivate: boolean): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new FetchError("INVALID_URL", `Could not parse URL: ${rawUrl}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchError("INVALID_PROTOCOL", `Only http(s) URLs are fetched, got ${url.protocol}`);
  }
  if (allowPrivate) return url;

  const host = url.hostname;
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local")
  ) {
    throw new FetchError("PRIVATE_ADDRESS", `Refusing to fetch private address ${host}`);
  }
  if (net.isIPv4(host)) {
    if (isPrivateIp(host)) throw new FetchError("PRIVATE_ADDRESS", `Refusing to fetch private address ${host}`);
    return url;
  }
  try {
    const records = await dns.resolve4(host);
    if (records.some(isPrivateIp)) {
      throw new FetchError("PRIVATE_ADDRESS", `DNS for ${host} resolves to a private address`);
    }
  } catch (e) {
    if (e instanceof FetchError) throw e;
    throw new FetchError("DNS_FAILURE", `Could not resolve ${host}`);
  }
  return url;
}

function isPrivateIp(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return true;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 169 && b === 254)
  );
}

/** naive robots.txt check: fetch and look for a matching User-agent:/Disallow: pair */
export async function robotsAllows(
  url: URL,
  userAgent: string,
  timeoutMs = 5000
): Promise<boolean> {
  try {
    const robotsUrl = new URL("/robots.txt", url.origin).toString();
    const res = await fetchPage(robotsUrl, { timeoutMs, maxBytes: 64 * 1024, allowPrivateUrls: true, skipRobots: true });
    if (!res.ok) return true; // no robots.txt => allowed
    const lines = res.body.split("\n").map((l) => l.trim());
    let applies = false;
    for (const line of lines) {
      const m = line.match(/^(user-agent):(.*)$/i);
      if (m) {
        applies = m[2].trim() === "*" || userAgent.includes(m[2].trim());
        continue;
      }
      const d = line.match(/^disallow:(.*)$/i);
      if (applies && d) {
        const path = d[1].trim();
        if (path && url.pathname.startsWith(path)) return false;
      }
    }
    return true;
  } catch {
    return true; 
  }
}

const ALLOWED_CONTENT_TYPES = [
  "text/html",
  "text/plain",
  "application/xhtml+xml",
];

function detectBlockReason(html: string, status: number): string | null {
  const head = html.slice(0, 4000);
  if (/Ray ID:|Attention Required!.*Cloudflare|cf-error-details|Cloudflare Ray ID/i.test(head)) {
    return "blocked by Cloudflare bot protection";
  }
  if (/Access to this page has been denied|PerimeterX|_pxhd|Please verify you are a human/i.test(head)) {
    return "blocked by bot-mitigation challenge (PerimeterX)";
  }
  if (/AkamaiGHost|Reference #\d+\.[0-9a-f]+/i.test(head)) {
    return "blocked by Akamai bot protection";
  }
  if (/Please enable JavaScript and cookies to continue/i.test(head)) {
    return "blocked by a JavaScript/cookie challenge page";
  }
  if (status === 403 && /Access Denied|Request blocked/i.test(head)) {
    return "blocked by the site's WAF (403)";
  }
  return null;
}


export async function fetchPage(
  rawUrl: string,
  opts: FetchOptions & { userAgent?: string; skipRobots?: boolean } = {}
): Promise<FetchResult> {
  const {
    timeoutMs = 10_000,
    maxBytes = 500 * 1024,
    allowPrivateUrls = true,
    userAgent = "PrepKitBot/1.0 (+research; contact on request)",
    skipRobots = false,
  } = opts;

  const url = await assertPublicUrl(rawUrl, allowPrivateUrls);

  if (!skipRobots && !(await robotsAllows(url, userAgent, timeoutMs))) {
    return { ok: false, status: 0, finalUrl: url.toString(), contentType: "", body: "blocked by robots.txt" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": userAgent, accept: "text/html,text/plain" },
    });
    const ct = res.headers.get("content-type") ?? "";
    if (!res.ok) {

      let reason = `HTTP ${res.status}`;
      if ((res.status === 403 || res.status === 503) && ct.includes("text/html")) {
        try {
          const peek = await res.clone().text();
          reason = detectBlockReason(peek, res.status) ?? reason;
        } catch {

        }
      }
      return { ok: false, status: res.status, finalUrl: res.url || url.toString(), contentType: ct, body: reason };
    }
    if (!ALLOWED_CONTENT_TYPES.some((t) => ct.includes(t))) {
      return { ok: false, status: res.status, finalUrl: res.url || url.toString(), contentType: ct, body: `unsupported content-type: ${ct}` };
    }
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > maxBytes) {
      return { ok: false, status: res.status, finalUrl: res.url || url.toString(), contentType: ct, body: `too large: ${len} bytes` };
    }
    // read with a size cap (streamed guard)
    const reader = res.body?.getReader();
    if (!reader) return { ok: false, status: res.status, finalUrl: res.url || url.toString(), contentType: ct, body: "empty body" };
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, status: res.status, finalUrl: res.url || url.toString(), contentType: ct, body: "exceeded size limit while streaming" };
      }
      chunks.push(value);
    }
    const html = Buffer.concat(chunks).toString("utf-8");

    const blocked = detectBlockReason(html, res.status);
    if (blocked) {
      return { ok: false, status: res.status, finalUrl: res.url || url.toString(), contentType: ct, body: blocked };
    }
    return { ok: true, status: res.status, finalUrl: res.url || url.toString(), contentType: ct, body: html };
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? `timed out after ${timeoutMs}ms` : String(e?.message ?? e);
    return { ok: false, status: 0, finalUrl: url.toString(), contentType: "", body: msg };
  } finally {
    clearTimeout(timer);
  }
}


export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim()
    .slice(0, 20_000); // hard cap on page text entering the model context
}

/** Extract absolute links (following relative paths) from a page. */
export function extractLinks(html: string, baseUrl: string): { url: string; text: string }[] {
  const out: { url: string; text: string }[] = [];
  const seen = new Set<string>();
  const re = /<a\s[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 200) {
    try {
      const abs = new URL(m[1], baseUrl).toString();
      if (!abs.startsWith("http")) continue;
      const u = new URL(abs);
      u.hash = "";
      const key = u.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ url: key, text: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() });
    } catch {
     
    }
  }
  return out;
}
