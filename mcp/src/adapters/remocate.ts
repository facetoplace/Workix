import { fetchText } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

const BASE = "https://www.remocate.app";

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function links(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const href = m[1];
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) continue;
    if (/\/jobs?\//i.test(href) || /job|career|vacanc/i.test(href)) {
      out.add(new URL(href, BASE).toString());
    }
  }
  return [...out];
}

function titleFrom(html: string, link: string): string {
  const heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    || html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1]
    || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return decode(heading || link.split("/").pop() || "Remocate role").slice(0, 200);
}

export async function fetchRemocateJobs(opts?: { keywords?: string[]; limit?: number; pages?: number }): Promise<{ jobs: Job[]; error?: string }> {
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100);
  const pages = Math.min(Math.max(opts?.pages ?? 3, 1), 10);
  const pagesFetched = await Promise.all(Array.from({ length: pages }, (_, i) =>
    fetchText(`${BASE}/${i ? `?ee7bb4b9_page=${i + 1}` : ""}`, { proxy: false, timeoutMs: 20000 }),
  ));
  const urls = [...new Set(pagesFetched.flatMap((r) => r.ok ? links(r.text) : []))].slice(0, limit);
  const words = (opts?.keywords || []).map((x) => x.trim().toLowerCase()).filter(Boolean);
  const jobs = (await Promise.all(urls.map(async (link): Promise<Job | null> => {
    const r = await fetchText(link, { proxy: false, timeoutMs: 15000 });
    if (!r.ok) return null;
    const description = decode(r.text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1] || r.text);
    const title = titleFrom(r.text, link);
    if (words.length && !words.some((w) => `${title} ${description}`.toLowerCase().includes(w))) return null;
    const now = new Date().toISOString();
    return { id: jobId("remocate", link), platform: "remocate", kind: "job", title, description: description.slice(0, 4000), link, date: now, fetchedAt: now, raw: { source: "remocate_public_html" } };
  }))).filter((job): job is Job => Boolean(job));
  return jobs.length ? { jobs } : { jobs, error: "remocate: no public job cards parsed" };
}
