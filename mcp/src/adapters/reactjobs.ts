import { fetchText } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

/**
 * reactjobs.io — React / React Native / Flutter / mobile board. Server-rendered
 * HTML; each vacancy is an absolute link /react-jobs/<company>/<id>-<title-slug>,
 * so title and company come straight from the descriptive slug. No key.
 */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const PATHS = ["/jobs/react-native/remote", "/jobs/react/remote"];

const humanize = (slug: string) =>
  slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, " ").trim();

export async function fetchReactJobs(opts?: { keywords?: string[] }): Promise<{ jobs: Job[]; error?: string }> {
  const all = new Map<string, Job>();
  const errors: string[] = [];
  const now = new Date().toISOString();
  for (const path of PATHS) {
    const { text, ok, status, error } = await fetchText(`https://reactjobs.io${path}`, {
      headers: { "User-Agent": UA, "Accept-Language": "en" },
      timeoutMs: 20000,
    });
    if (!ok || !text) {
      errors.push(`${path}: ${error || "HTTP " + status}`);
      continue;
    }
    for (const m of text.matchAll(/https:\/\/reactjobs\.io\/react-jobs\/([a-z0-9-]+)\/(\d+)-([a-z0-9-]+)/gi)) {
      const [link, companySlug, id, titleSlug] = m;
      if (all.has(id)) continue;
      const company = humanize(companySlug);
      const title = humanize(titleSlug);
      all.set(id, {
        id: jobId("reactjobs", link),
        platform: "reactjobs",
        kind: "job",
        title: `${title}${company ? " @ " + company : ""}`,
        description: `Company: ${company}`,
        link,
        date: now,
        fetchedAt: now,
        raw: { company },
      });
    }
  }
  const jobs = [...all.values()];
  return { jobs, error: jobs.length ? undefined : errors.slice(0, 2).join("; ") || "reactjobs: no rows parsed" };
}
