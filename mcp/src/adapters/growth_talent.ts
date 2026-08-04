import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

interface GtSalary {
  min?: number | null;
  max?: number | null;
  currency?: string | null;
}

interface GtJob {
  id?: string;
  slug?: string;
  title?: string;
  category?: string;
  seniority?: string;
  contractType?: string;
  remote?: string;
  location?: string | null;
  salary?: GtSalary | null;
  postedAt?: string;
  company?: { name?: string | null; slug?: string | null };
  url?: string;
}

interface GtResponse {
  data?: GtJob[];
  pagination?: { page?: number; limit?: number; total?: number; totalPages?: number };
}

function formatSalary(s?: GtSalary | null): string | undefined {
  if (!s) return undefined;
  const cur = s.currency || "USD";
  if (s.min != null && s.max != null) return `${s.min}–${s.max} ${cur}`;
  if (s.min != null) return `from ${s.min} ${cur}`;
  if (s.max != null) return `up to ${s.max} ${cur}`;
  return undefined;
}

export async function fetchGrowthTalentJobs(opts?: {
  limit?: number;
  pages?: number;
  remote?: boolean;
  q?: string;
}): Promise<{ jobs: Job[]; error?: string }> {
  const pageSize = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
  const maxPages = Math.min(Math.max(opts?.pages ?? 2, 1), 5);
  const remote =
    opts?.remote ??
    (process.env.GROWTH_TALENT_REMOTE === "1" ||
      process.env.GROWTH_TALENT_REMOTE === "true");
  const q = opts?.q?.trim() || process.env.GROWTH_TALENT_Q?.trim() || "";

  const jobs: Job[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const qs = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    if (remote) qs.set("remote", "true");
    if (q) qs.set("q", q);
    const url = `https://www.growthtalent.org/api/v1/jobs?${qs}`;
    const { data, error, status } = await fetchJson<GtResponse>(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
      },
      proxy: false,
    });
    if (error || !data?.data || !Array.isArray(data.data)) {
      if (!jobs.length) {
        return { jobs: [], error: error || `Growth.Talent HTTP ${status}` };
      }
      break;
    }
    for (const row of data.data) {
      if (!row.title || !row.id) continue;
      const link =
        row.url ||
        `https://www.growthtalent.org/jobs/${row.slug || row.id}`;
      const company = row.company?.name ? ` @ ${row.company.name}` : "";
      jobs.push({
        id: jobId("growth_talent", String(row.id)),
        platform: "growth_talent",
        kind: "job",
        title: `${row.title}${company}`,
        description: [
          row.category,
          row.seniority,
          row.contractType,
          row.remote,
          row.location,
        ]
          .filter(Boolean)
          .join(" · ")
          .slice(0, 4000),
        link,
        date: row.postedAt
          ? new Date(row.postedAt).toISOString()
          : new Date().toISOString(),
        budget: formatSalary(row.salary),
        fetchedAt: new Date().toISOString(),
        raw: {
          category: row.category,
          seniority: row.seniority,
          remote: row.remote,
          slug: row.slug,
        },
      });
    }
    const totalPages = data.pagination?.totalPages ?? page;
    if (page >= totalPages || data.data.length < pageSize) break;
  }
  return { jobs };
}
