import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { dataDir, jobId } from "../store.js";
import type { Job } from "../types.js";

/**
 * JobsPipe — 39 ATS and board feeds normalized into one schema, including
 * LinkedIn, Indeed, Y Combinator, Greenhouse, Lever, Ashby, SmartRecruiters,
 * Workday, Workable and Paylocity.
 *
 * This is the metered path to boards that killed their own APIs, and the meter
 * is the thing to design around: **one credit = one job returned**, and the free
 * tier is 1000 jobs a month. A digest that pulls 50 rows on every run burns the
 * month in 20 runs, so this adapter keeps its own ledger and refuses to spend
 * past the budget instead of discovering the wall as a 429 mid-month.
 *
 * Verified live 2026-08-09 with a `jp_live_…` key:
 * - `POST https://api.jobspipe.dev/v1/jobs/search` → `{metadata, data}`
 * - rate limit headers say `ratelimit-policy: 2;w=1` — two requests a second
 * - `total_results` is null unless `include_total_results` is asked for
 * - there is **no write endpoint**: /v1/jobs, /v1/jobs/ingest → 404. JobsPipe
 *   indexes other people's boards; it does not accept postings.
 */

const SEARCH_URL = "https://api.jobspipe.dev/v1/jobs/search";
const MCP_URL = "https://mcp.jobspipe.dev/mcp";

/** Their limiter is 2 rps; stay just under it. */
const MIN_GAP_MS = 550;
let lastCallAt = 0;

async function pace(): Promise<void> {
  const wait = MIN_GAP_MS - (Date.now() - lastCallAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

export function jobspipeKey(): string {
  // JOBS_PIPE_KEY is the spelling on their dashboard; both are accepted.
  return (
    process.env.JOBSPIPE_API_KEY?.trim() ||
    process.env.JOBS_PIPE_KEY?.trim() ||
    ""
  );
}

export function jobspipeConfigured(): boolean {
  return Boolean(jobspipeKey());
}

/* ------------------------------- credit ledger ------------------------------ */

interface Ledger {
  month: string;
  jobs: number;
  calls: number;
  updatedAt: string;
}

function ledgerPath(): string {
  return join(dataDir(), "jobspipe-usage.json");
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function readLedger(): Ledger {
  const month = currentMonth();
  try {
    const raw = JSON.parse(readFileSync(ledgerPath(), "utf8")) as Ledger;
    if (raw.month === month) return raw;
  } catch {
    /* first run or corrupt — start clean */
  }
  return { month, jobs: 0, calls: 0, updatedAt: new Date().toISOString() };
}

function writeLedger(l: Ledger): void {
  try {
    mkdirSync(dirname(ledgerPath()), { recursive: true });
    writeFileSync(ledgerPath(), JSON.stringify(l, null, 2), "utf8");
  } catch {
    // A ledger we cannot persist must not break the search — worst case we
    // over-count within one process run.
  }
}

export function monthlyBudget(): number {
  const n = Number(process.env.JOBSPIPE_MONTHLY_BUDGET || 1000);
  return Number.isFinite(n) && n > 0 ? n : 1000;
}

export function jobspipeUsage(): {
  month: string;
  jobs: number;
  calls: number;
  budget: number;
  remaining: number;
  configured: boolean;
} {
  const l = readLedger();
  const budget = monthlyBudget();
  return {
    month: l.month,
    jobs: l.jobs,
    calls: l.calls,
    budget,
    remaining: Math.max(0, budget - l.jobs),
    configured: jobspipeConfigured(),
  };
}

/** Wipe the local counter — for when the plan renews off-cycle. */
export function resetJobspipeUsage(): Ledger {
  const fresh: Ledger = {
    month: currentMonth(),
    jobs: 0,
    calls: 0,
    updatedAt: new Date().toISOString(),
  };
  writeLedger(fresh);
  return fresh;
}

function spend(jobs: number): void {
  const l = readLedger();
  l.jobs += jobs;
  l.calls += 1;
  l.updatedAt = new Date().toISOString();
  writeLedger(l);
}

/* --------------------------------- search ---------------------------------- */

interface JobsPipeJob {
  id?: string;
  job_title?: string;
  normalized_title?: string;
  company?: string;
  company_domain?: string;
  url?: string;
  final_url?: string;
  source_url?: string;
  date_posted?: string;
  discovered_at?: string;
  status?: string;
  has_blurred_data?: boolean;
  min_annual_salary?: number;
  max_annual_salary?: number;
  salary_string?: string;
  salary_currency?: string;
  location?: string;
  short_location?: string;
  country?: string;
  country_code?: string;
  cities?: string[];
  remote?: boolean;
  hybrid?: boolean;
  work_arrangement?: string;
  seniority?: string;
  is_manager?: boolean;
  job_function?: string;
  employment_statuses?: string[];
  easy_apply?: boolean;
  technology_slugs?: string[];
  keyword_slugs?: string[];
  occupation_label?: string;
  description?: string;
  sources?: Array<{ name?: string; url?: string }> | string[];
}

interface JobsPipeResponse {
  data?: JobsPipeJob[];
  metadata?: {
    total_results?: number | null;
    truncated_results?: number;
    next_cursor?: string | null;
  };
}

export interface JobsPipeFilters {
  titles?: string[];
  excludeTitles?: string[];
  keywords?: string[];
  companies?: string[];
  skills?: string[];
  locations?: string[];
  countries?: string[];
  sources?: string[];
  excludeSources?: string[];
  seniority?: string[];
  employmentTypes?: string[];
  remoteOnly?: boolean;
  workArrangements?: string[];
  maxAgeDays?: number;
  limit?: number;
  includeTotal?: boolean;
}

function envList(name: string): string[] | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const out = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return out.length ? out : undefined;
}

/**
 * Default 25, not 50: at one credit per row a digest that runs a few times a
 * day has to fit inside 1000 rows a month.
 */
function resolveLimit(requested?: number): number {
  const fallback = Number(process.env.JOBSPIPE_LIMIT || 25);
  const n = requested ?? (Number.isFinite(fallback) ? fallback : 25);
  return Math.min(Math.max(n, 1), 100);
}

function buildBody(f: JobsPipeFilters): Record<string, unknown> {
  const titles =
    f.titles?.filter(Boolean) ||
    envList("JOBSPIPE_TITLES") ||
    (f.keywords?.length ? f.keywords : ["Software Engineer"]);

  const body: Record<string, unknown> = {
    job_title_or: titles,
    limit: resolveLimit(f.limit),
  };

  const excludeTitles = f.excludeTitles || envList("JOBSPIPE_EXCLUDE_TITLES");
  if (excludeTitles?.length) body.job_title_not = excludeTitles;
  // description_or matches skills/tech inside the posting body, so digest
  // keywords go here rather than narrowing the title list further.
  if (f.keywords?.length && f.titles?.length) body.description_or = f.keywords;
  const companies = f.companies || envList("JOBSPIPE_COMPANIES");
  if (companies?.length) body.company_name_or = companies;
  const skills = f.skills || envList("JOBSPIPE_SKILLS");
  if (skills?.length) body.skills_or = skills;
  const locations = f.locations || envList("JOBSPIPE_LOCATIONS");
  if (locations?.length) body.job_location_or = locations;
  const countries = f.countries || envList("JOBSPIPE_COUNTRIES");
  if (countries?.length) body.job_country_code_or = countries;
  const sources = f.sources || envList("JOBSPIPE_SOURCES");
  if (sources?.length) body.source_or = sources;
  const excludeSources = f.excludeSources || envList("JOBSPIPE_EXCLUDE_SOURCES");
  if (excludeSources?.length) body.source_not = excludeSources;
  const seniority = f.seniority || envList("JOBSPIPE_SENIORITY");
  if (seniority?.length) body.job_seniority_or = seniority;
  const employment = f.employmentTypes || envList("JOBSPIPE_EMPLOYMENT_TYPES");
  if (employment?.length) body.employment_type_or = employment;
  const arrangements =
    f.workArrangements || envList("JOBSPIPE_WORK_ARRANGEMENTS");
  if (arrangements?.length) body.work_arrangement_or = arrangements;

  const remote = f.remoteOnly ?? process.env.JOBSPIPE_REMOTE_ONLY !== "0";
  if (remote) body.remote = true;

  const maxAge =
    f.maxAgeDays ?? Number(process.env.JOBSPIPE_MAX_AGE_DAYS || 14);
  if (Number.isFinite(maxAge) && maxAge > 0) {
    body.posted_at_max_age_days = maxAge;
  }
  // Costs nothing extra but is null unless asked for; off by default.
  if (f.includeTotal) body.include_total_results = true;

  return body;
}

export async function fetchJobsPipeJobs(
  filters?: JobsPipeFilters,
): Promise<{ jobs: Job[]; error?: string; totalCount?: number }> {
  const key = jobspipeKey();
  if (!key) {
    return {
      jobs: [],
      error: "jobspipe: JOBSPIPE_API_KEY / JOBS_PIPE_KEY missing (optional)",
    };
  }

  const f = filters || {};
  const budget = monthlyBudget();
  const used = readLedger().jobs;
  const remaining = budget - used;
  if (remaining <= 0) {
    return {
      jobs: [],
      error:
        `jobspipe: monthly budget spent (${used}/${budget} jobs this month). ` +
        `Raise JOBSPIPE_MONTHLY_BUDGET, or reset the counter if the plan renewed.`,
    };
  }

  const body = buildBody(f);
  // Never ask for more rows than the budget can pay for.
  body.limit = Math.min(body.limit as number, remaining);

  let data: JobsPipeResponse;
  try {
    await pace();
    const res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const hint =
        res.status === 429
          ? " (rate limit is 2 req/s, or the monthly quota is gone)"
          : res.status === 401 || res.status === 403
            ? " (check the jp_live_… key)"
            : "";
      return { jobs: [], error: `JobsPipe HTTP ${res.status}${hint}` };
    }
    data = (await res.json()) as JobsPipeResponse;
  } catch (e) {
    return {
      jobs: [],
      error: `jobspipe: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const rows = data.data || [];
  // Charged per row returned, whether or not we keep it.
  spend(rows.length);

  const jobs: Job[] = [];
  for (const j of rows) {
    const link = j.url || j.final_url || j.source_url;
    const title = j.job_title || j.normalized_title;
    if (!title || !link) continue;
    if (j.status && j.status !== "active") continue;
    const cur = j.salary_currency || "USD";
    const budgetStr =
      j.salary_string ||
      (j.min_annual_salary && j.max_annual_salary
        ? `${j.min_annual_salary}–${j.max_annual_salary} ${cur}/yr`
        : undefined);
    jobs.push({
      id: jobId("jobspipe", j.id || link),
      platform: "jobspipe",
      kind: "job",
      title: `${title}${j.company ? ` @ ${j.company}` : ""}`,
      description: (j.description || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4000),
      link,
      date: (j.date_posted || j.discovered_at)
        ? new Date((j.date_posted || j.discovered_at) as string).toISOString()
        : new Date().toISOString(),
      budget: budgetStr,
      fetchedAt: new Date().toISOString(),
      raw: {
        location: j.short_location || j.location,
        country: j.country,
        country_code: j.country_code,
        remote: j.remote,
        hybrid: j.hybrid,
        work_arrangement: j.work_arrangement,
        seniority: j.seniority,
        is_manager: j.is_manager,
        job_function: j.job_function,
        employment: j.employment_statuses,
        // Worth surfacing: these apply in one click, no ATS account needed.
        easy_apply: j.easy_apply,
        tech: j.technology_slugs,
        company_domain: j.company_domain,
        // The same role on LinkedIn and on the company's Greenhouse board comes
        // back as two rows with two ids — keep provenance for dedup upstream.
        sources: Array.isArray(j.sources)
          ? j.sources.map((s) => (typeof s === "string" ? s : s?.name))
          : undefined,
        blurred: j.has_blurred_data || undefined,
      },
    });
  }

  return {
    jobs,
    totalCount:
      data.metadata?.total_results ?? data.metadata?.truncated_results,
  };
}

/* ---------------------------- tech stack (MCP only) ------------------------- */

/**
 * `detect_company_tech_stack` has no REST route (probed 2026-08-09: /v1/stack*
 * → 404), so it is called over their MCP endpoint. Useful before writing a
 * proposal: naming the stack a company actually runs beats guessing from the
 * job ad.
 */
export async function detectCompanyTechStack(args: {
  domain: string;
  mode?: string;
}): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const key = jobspipeKey();
  if (!key) {
    return {
      ok: false,
      error: "jobspipe: JOBSPIPE_API_KEY / JOBS_PIPE_KEY missing",
    };
  }
  const domain = args.domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!domain) return { ok: false, error: "domain is required" };

  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  async function rpc(payload: unknown): Promise<string> {
    await pace();
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`MCP HTTP ${res.status}`);
    return res.text();
  }

  try {
    await rpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "workix-mcp", version: "0.3.2" },
      },
    });
    const raw = await rpc({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "detect_company_tech_stack",
        arguments: { domain, ...(args.mode ? { mode: args.mode } : {}) },
      },
    });
    // Streamable-http answers may arrive as an SSE frame.
    const body = raw.replace(/^event:[^\n]*\ndata: /, "").trim();
    const parsed = JSON.parse(body) as {
      result?: { content?: Array<{ text?: string }>; isError?: boolean };
      error?: { message?: string };
    };
    if (parsed.error) return { ok: false, error: parsed.error.message };
    const text = parsed.result?.content?.[0]?.text;
    if (!text) return { ok: false, error: "empty tech stack response" };
    try {
      return { ok: !parsed.result?.isError, result: JSON.parse(text) };
    } catch {
      return { ok: !parsed.result?.isError, result: text };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
