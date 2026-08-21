import { fetchText } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

const BASE = "https://thehub.io";

function decode(s: string): string {
  return s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function jsonLd(html: string): Record<string, unknown> | undefined {
  for (const raw of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const value = JSON.parse(raw[1]) as Record<string, unknown>;
      if (value["@type"] === "JobPosting" || value.title || value.description) return value;
    } catch { /* layout may contain non-JSON scripts */ }
  }
  return undefined;
}

function links(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href=["'](\/jobs\/[a-z0-9]+)["']/gi)) out.add(`${BASE}${m[1]}`);
  return [...out];
}

export async function fetchTheHubJobs(opts?: { keywords?: string[]; limit?: number; pages?: number }): Promise<{ jobs: Job[]; error?: string }> {
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100);
  const pages = Math.min(Math.max(opts?.pages ?? 2, 1), 5);
  const listings = await Promise.all(Array.from({ length: pages }, (_, i) => fetchText(`${BASE}/jobs/${i ? `?page=${i + 1}` : ""}`, { proxy: false, timeoutMs: 20000 })));
  const urls = [...new Set(listings.flatMap((r) => links(r.text)))].slice(0, limit);
  const words = (opts?.keywords || []).map((x) => x.trim().toLowerCase()).filter(Boolean);
  const details = await Promise.all(urls.map(async (link): Promise<Job | null> => {
    const r = await fetchText(link, { proxy: false, timeoutMs: 15000 });
    if (!r.ok) return null;
    const data = jsonLd(r.text);
    const title = String(data?.title || decode(r.text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || link.split("/").pop() || "The Hub"));
    const description = decode(String(data?.description || r.text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1] || ""));
    if (words.length && !words.some((w) => `${title} ${description}`.toLowerCase().includes(w))) return null;
    const now = new Date().toISOString();
    return { id: jobId("thehub", link), platform: "thehub", kind: "job", title: title.slice(0, 200), description: description.slice(0, 3000), link, date: now, fetchedAt: now, raw: { source: "thehub_jobposting", company: data?.hiringOrganization } };
  }));
  const jobs = details.filter((job): job is Job => Boolean(job));
  return jobs.length ? { jobs } : { jobs, error: "thehub: no public job cards parsed" };
}
