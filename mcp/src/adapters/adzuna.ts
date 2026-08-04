import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

interface AdzunaJob {
  id?: string | number;
  title?: string;
  description?: string;
  created?: string;
  redirect_url?: string;
  salary_min?: number;
  salary_max?: number;
  company?: { display_name?: string };
  location?: { display_name?: string };
  category?: { label?: string; tag?: string };
  contract_type?: string;
  contract_time?: string;
}

interface AdzunaResponse {
  results?: AdzunaJob[];
  count?: number;
}

export function adzunaConfigured(): boolean {
  return Boolean(
    process.env.ADZUNA_APP_ID?.trim() && process.env.ADZUNA_APP_KEY?.trim(),
  );
}

export async function fetchAdzunaJobs(opts?: {
  what?: string;
  country?: string;
  page?: number;
  resultsPerPage?: number;
}): Promise<{ jobs: Job[]; error?: string; totalCount?: number }> {
  const appId = process.env.ADZUNA_APP_ID?.trim();
  const appKey = process.env.ADZUNA_APP_KEY?.trim();
  if (!appId || !appKey) {
    return {
      jobs: [],
      error: "ADZUNA_APP_ID / ADZUNA_APP_KEY missing (optional)",
    };
  }

  const country = (
    opts?.country ||
    process.env.ADZUNA_COUNTRY ||
    "gb"
  )
    .trim()
    .toLowerCase();
  const what =
    opts?.what?.trim() ||
    process.env.ADZUNA_WHAT?.trim() ||
    "mobile OR android OR ios OR flutter OR typescript OR react";
  const page = opts?.page ?? 1;
  const resultsPerPage = Math.min(opts?.resultsPerPage ?? 50, 50);

  const qs = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: String(resultsPerPage),
    what,
    content_type: "application/json",
  });
  // Prefer remote-ish results when supported; Adzuna uses where= for location
  if (process.env.ADZUNA_WHERE?.trim()) {
    qs.set("where", process.env.ADZUNA_WHERE.trim());
  }

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${qs}`;
  const { data, error, status } = await fetchJson<AdzunaResponse>(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
    },
    proxy: false,
  });

  if (error || !data?.results || !Array.isArray(data.results)) {
    return {
      jobs: [],
      error: error || `Adzuna HTTP ${status}`,
      totalCount: data?.count,
    };
  }

  const jobs: Job[] = [];
  for (const row of data.results) {
    if (!row.title || !row.redirect_url) continue;
    const company = row.company?.display_name;
    const budget =
      row.salary_min || row.salary_max
        ? `${row.salary_min || "?"}–${row.salary_max || "?"}`
        : undefined;
    jobs.push({
      id: jobId("adzuna", String(row.id || row.redirect_url)),
      platform: "adzuna",
      kind: "job",
      title: `${row.title}${company ? " @ " + company : ""}`,
      description: (row.description || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4000),
      link: row.redirect_url,
      date: row.created
        ? new Date(row.created).toISOString()
        : new Date().toISOString(),
      budget,
      fetchedAt: new Date().toISOString(),
      raw: {
        location: row.location?.display_name,
        category: row.category?.label,
        contract_type: row.contract_type,
        contract_time: row.contract_time,
        country,
      },
    });
  }

  return { jobs, totalCount: data.count };
}
