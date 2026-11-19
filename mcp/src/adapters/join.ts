import { fetchJson, fetchText } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

export const JOIN_GRAPHQL_URL = "https://join.com/candidate-api/graphql";
const MAX_ROWS = 200;
const QUERY = `query PublicJobsList($input: PublicJobsQueryInput!) {
  publicJobs(input: $input) {
    items {
      idParam
      company { id name domain }
      companyId
      country { iso3166 name }
      id
      title
      updatedAt
      createdAt
      category { name }
      employmentType { name }
      workplaceType
    }
    pageInfo { page pageCount pageSize rowCount }
  }
}`;

type JoinRow = {
  idParam?: unknown;
  company?: { id?: unknown; name?: unknown; domain?: unknown };
  companyId?: unknown;
  country?: { iso3166?: unknown; name?: unknown };
  id?: unknown;
  title?: unknown;
  updatedAt?: unknown;
  createdAt?: unknown;
  category?: { name?: unknown };
  employmentType?: { name?: unknown };
  workplaceType?: unknown;
};

export interface JoinQuery {
  companyId: number;
  page?: number;
  pageSize?: number;
}

function text(value: unknown, max = 1_000): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function rowToJob(row: JoinRow, fetchedAt: string): Job | undefined {
  const id = text(row.idParam) || text(row.id);
  const company = text(row.company?.domain) || text(row.company?.name);
  const title = text(row.title, 240);
  if (!id || !title || !company) return undefined;
  return {
    id: jobId("join", id),
    platform: "join",
    kind: "job",
    title,
    description: [
      text(row.company?.name),
      text(row.category?.name),
      text(row.employmentType?.name),
      text(row.workplaceType),
      text(row.country?.name),
    ].filter(Boolean).join(" · ") || title,
    link: `https://join.com/companies/${encodeURIComponent(company)}/${encodeURIComponent(id)}`,
    date: text(row.updatedAt) || text(row.createdAt) || fetchedAt,
    fetchedAt,
    raw: {
      source: "join_public_jobs",
      sourceId: text(row.id),
      company: text(row.company?.name),
      companyId: text(row.companyId),
      country: text(row.country?.name),
      countryCode: text(row.country?.iso3166),
      category: text(row.category?.name),
      employmentType: text(row.employmentType?.name),
      workplaceType: text(row.workplaceType),
    },
  };
}

export function normaliseJoinPayload(payload: unknown): JoinRow[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const data = payload as { data?: { publicJobs?: { items?: unknown } } };
  const items = data.data?.publicJobs?.items;
  return Array.isArray(items)
    ? items.slice(0, MAX_ROWS).filter((item): item is JoinRow => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
}

export function buildJoinRequest(opts: JoinQuery): { query: string; variables: Record<string, unknown> } {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(Math.max(Math.floor(opts.pageSize ?? 50), 1), MAX_ROWS);
  return {
    query: QUERY,
    variables: {
      input: {
        companyId: Math.floor(opts.companyId),
        paginationPage: { page, pageSize },
        filters: {},
        aggregateBy: [],
        sort: [],
      },
    },
  };
}

export async function fetchJoinJobs(opts: JoinQuery): Promise<{ jobs: Job[]; error?: string }> {
  if (!Number.isInteger(opts.companyId) || opts.companyId < 1) {
    return { jobs: [], error: "Join requires a positive companyId" };
  }
  const { query, variables } = buildJoinRequest(opts);
  const { data, error, status } = await fetchJson<unknown>(JOIN_GRAPHQL_URL, {
    method: "POST",
    body: JSON.stringify({ query, variables }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: "https://join.com",
      Referer: "https://join.com/jobs",
      "User-Agent": "WorkixMCP/1.0 (read-only Join feed)",
    },
    proxy: false,
  });
  if (error || data === undefined) return { jobs: [], error: error || `Join HTTP ${status}` };
  const rows = normaliseJoinPayload(data);
  const fetchedAt = new Date().toISOString();
  const jobs = rows.map((row) => rowToJob(row, fetchedAt)).filter(Boolean) as Job[];
  return { jobs, error: jobs.length || rows.length ? undefined : "Join returned no public jobs" };
}

/**
 * Resolve a public Join company domain (e.g. "dfrost") to its numeric companyId
 * by reading the company's public page. Join's GraphQL jobs query is keyed by
 * companyId, not by domain, and there is no public "search by domain" field.
 */
export async function resolveJoinCompanyId(domain: string): Promise<number | undefined> {
  const clean = domain.replace(/^https?:\/\/(www\.)?join\.com\//i, "").replace(/[#?].*$/, "").replace(/\/+$/, "");
  const slug = clean.split("/")[0];
  if (!slug) return undefined;
  const { text: page, ok } = await fetchText(`https://join.com/companies/${encodeURIComponent(slug)}`, {
    headers: { "User-Agent": "WorkixMCP/1.0 (read-only Join feed)", Accept: "text/html" },
    proxy: false,
    timeoutMs: 20000,
  });
  if (!ok || !page) return undefined;
  const m = page.match(/"companyId"\s*:\s*(\d+)/);
  return m ? Number(m[1]) : undefined;
}

export const _joinInternals = { rowToJob };
