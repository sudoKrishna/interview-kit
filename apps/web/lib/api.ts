

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function call(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    const err: any = new Error(body?.error?.message ?? `Request failed (${res.status})`);
    err.status = res.status;
    err.code = body?.error?.code;
    err.kitId = body?.error?.kitId; // DUPLICATE_KIT carries the existing kit's id
    throw err;
  }
  return body;
}

export const api = {
  register(email: string, password: string) {
    return call("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  login(email: string, password: string) {
    return call("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  logout() {
    return call("/api/auth/logout", { method: "POST" });
  },

  me() {
    return call("/api/auth/me");
  },

  listKits() {
    return call("/api/kits");
  },

  createKit(jd: string, companyUrl: string, days: number) {
    return call("/api/kits", {
      method: "POST",
      body: JSON.stringify({ jd, company_url: companyUrl, days }),
    });
  },

  getProgress(id: string) {
    return call(`/api/kits/${id}/progress`);
  },

  getKit(id: string) {
    return call(`/api/kits/${id}`);
  },

  /** Builder mutations — returns the updated kit. */
  mutate(id: string, body: unknown) {
    return call(`/api/kits/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  /** Regenerate one section; `category` is required for section "questions". */
  regenerate(id: string, section: "company_brief" | "questions" | "schedule", category?: string) {
    return call(`/api/kits/${id}/regenerate`, {
      method: "POST",
      body: JSON.stringify({ section, category }),
    });
  },

  /** Practice mode — record confidence (1..5) on a flashcard. */
  recordPractice(id: string, flashcardId: string, confidence: number) {
    return call(`/api/kits/${id}/practice`, {
      method: "POST",
      body: JSON.stringify({ flashcardId, confidence }),
    });
  },
};
