import { loadEnv } from "../env.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

const API = "https://www.freelancer.com/api";

export function freelancerConfigured(): boolean {
  loadEnv();
  return Boolean(process.env.FREELANCER_OAUTH_TOKEN?.trim());
}

interface FlnProject {
  id?: number;
  title?: string;
  preview_description?: string;
  description?: string;
  seo_url?: string;
  time_submitted?: number;
  budget?: { minimum?: number; maximum?: number };
  currency?: { code?: string };
}

async function flnFetch<T>(
  path: string,
  opts?: { method?: string; body?: unknown },
): Promise<{ data?: T; error?: string; status: number }> {
  loadEnv();
  const token = process.env.FREELANCER_OAUTH_TOKEN?.trim();
  if (!token) return { error: "FREELANCER_OAUTH_TOKEN missing", status: 0 };

  try {
    const res = await fetch(`${API}${path}`, {
      method: opts?.method || "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Freelancer-OAuth-V1": token,
        Accept: "application/json",
      },
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let json: { result?: T; message?: string; error?: unknown } = {};
    try {
      json = JSON.parse(text) as typeof json;
    } catch {
      return {
        error: `Freelancer non-JSON HTTP ${res.status}: ${text.slice(0, 300)}`,
        status: res.status,
      };
    }
    if (!res.ok) {
      return {
        error:
          json.message ||
          `HTTP ${res.status}: ${text.slice(0, 300)}`,
        status: res.status,
      };
    }
    return { data: json.result, status: res.status };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : String(e),
      status: 0,
    };
  }
}

export async function fetchFreelancerJobs(opts?: {
  query?: string;
  limit?: number;
}): Promise<{ jobs: Job[]; error?: string }> {
  if (!freelancerConfigured()) {
    return { jobs: [], error: "FREELANCER_OAUTH_TOKEN missing (optional)" };
  }

  loadEnv();
  const q =
    opts?.query?.trim() ||
    process.env.FREELANCER_SEARCH?.trim() ||
    "VPN OR WireGuard OR Flutter OR mobile OR Android OR iOS";
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50);

  const params = new URLSearchParams({
    limit: String(limit),
    offset: "0",
    compact: "true",
    full_description: "true",
  });
  // Active projects search — query string varies by API version; try search_query
  params.set("query", q);
  params.set("project_types[]", "fixed");
  params.append("project_types[]", "hourly");

  const path = `/projects/0.1/projects/active/?${params}`;
  const r = await flnFetch<{ projects?: FlnProject[] }>(path);

  if (r.error && !r.data?.projects) {
    // Fallback: projects endpoint with or_search_query
    const alt = new URLSearchParams({
      limit: String(limit),
      "or_search_query[]": q,
      compact: "true",
    });
    const r2 = await flnFetch<{ projects?: FlnProject[] }>(
      `/projects/0.1/projects/?${alt}`,
    );
    if (r2.error && !r2.data?.projects) {
      return { jobs: [], error: r.error || r2.error };
    }
    return { jobs: mapProjects(r2.data?.projects || []), error: r2.error };
  }

  return { jobs: mapProjects(r.data?.projects || []), error: r.error };
}

function mapProjects(projects: FlnProject[]): Job[] {
  const jobs: Job[] = [];
  for (const p of projects) {
    if (!p.id || !p.title) continue;
    const link = p.seo_url
      ? `https://www.freelancer.com/projects/${p.seo_url}`
      : `https://www.freelancer.com/projects/${p.id}`;
    const cur = p.currency?.code || "USD";
    const budget =
      p.budget?.minimum || p.budget?.maximum
        ? `${p.budget.minimum ?? "?"}-${p.budget.maximum ?? "?"} ${cur}`
        : undefined;
    const date = p.time_submitted
      ? new Date(p.time_submitted * 1000).toISOString()
      : new Date().toISOString();
    jobs.push({
      id: jobId("freelancer_com", link),
      platform: "freelancer_com",
      kind: "gig",
      title: p.title,
      description: (
        p.preview_description ||
        p.description ||
        ""
      ).slice(0, 4000),
      link,
      date,
      budget,
      fetchedAt: new Date().toISOString(),
      raw: p,
    });
  }
  return jobs;
}

export async function freelancerPlaceBid(opts: {
  projectId: number;
  amount: number;
  period: number;
  description: string;
}): Promise<{ ok: boolean; error?: string; raw?: unknown }> {
  if (!freelancerConfigured()) {
    return { ok: false, error: "FREELANCER_OAUTH_TOKEN missing" };
  }

  const r = await flnFetch<unknown>(`/projects/0.1/bids/`, {
    method: "POST",
    body: {
      project_id: opts.projectId,
      amount: opts.amount,
      period: opts.period,
      description: opts.description,
      milestone_percentage: 100,
    },
  });

  if (r.error) return { ok: false, error: r.error, raw: r.data };
  return { ok: true, raw: r.data };
}

export function freelancerProjectId(job: Job): number | undefined {
  const raw = job.raw as FlnProject | undefined;
  return typeof raw?.id === "number" ? raw.id : undefined;
}
