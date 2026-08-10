import { jobId } from "../store.js";
import type { Job } from "../types.js";

/**
 * Jooble — aggregator over 70+ countries (ru/ua/kz/pl included).
 * Free key on request at https://jooble.org/api/about → `JOOBLE_API_KEY`.
 * The key is part of the path, not a header, and search is POST-only.
 */

interface JoobleJob {
  id?: number | string;
  title?: string;
  location?: string;
  snippet?: string;
  salary?: string;
  source?: string;
  type?: string;
  link?: string;
  company?: string;
  updated?: string;
}

interface JoobleResponse {
  totalCount?: number;
  jobs?: JoobleJob[];
}

export function joobleConfigured(): boolean {
  return Boolean(process.env.JOOBLE_API_KEY?.trim());
}

export async function fetchJoobleJobs(opts?: {
  keywords?: string;
  location?: string;
  page?: number;
}): Promise<{ jobs: Job[]; error?: string; totalCount?: number }> {
  const key = process.env.JOOBLE_API_KEY?.trim();
  if (!key) {
    return { jobs: [], error: "jooble: JOOBLE_API_KEY missing (optional)" };
  }

  const keywords =
    opts?.keywords?.trim() || process.env.JOOBLE_KEYWORDS?.trim() || "developer";
  const location =
    opts?.location?.trim() || process.env.JOOBLE_LOCATION?.trim() || "";

  let data: JoobleResponse;
  try {
    const res = await fetch(`https://jooble.org/api/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
      },
      body: JSON.stringify({
        keywords,
        location,
        page: String(opts?.page ?? 1),
      }),
    });
    if (!res.ok) return { jobs: [], error: `Jooble HTTP ${res.status}` };
    data = (await res.json()) as JoobleResponse;
  } catch (e) {
    return {
      jobs: [],
      error: `jooble: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const jobs: Job[] = [];
  for (const j of data.jobs || []) {
    if (!j.title || !j.link) continue;
    jobs.push({
      id: jobId("jooble", String(j.id || j.link)),
      platform: "jooble",
      kind: "job",
      title: `${j.title}${j.company ? ` @ ${j.company}` : ""}`,
      description: (j.snippet || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4000),
      link: j.link,
      date: j.updated
        ? new Date(j.updated).toISOString()
        : new Date().toISOString(),
      budget: j.salary || undefined,
      fetchedAt: new Date().toISOString(),
      raw: { location: j.location, source: j.source, type: j.type },
    });
  }

  return { jobs, totalCount: data.totalCount };
}
