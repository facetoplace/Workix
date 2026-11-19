import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

export const OPENRADAR_API_URL = "https://openradar.fun/api/leads";
const MAX_TEXT = 20_000;
const MAX_ROWS = 500;

export interface OpenRadarLead {
  id?: unknown;
  type?: unknown;
  title?: unknown;
  text?: unknown;
  url?: unknown;
  canonicalUrl?: unknown;
  author?: unknown;
  city?: unknown;
  budget?: unknown;
  currency?: unknown;
  paymentPeriod?: unknown;
  rawSalary?: unknown;
  normalizedUsdMin?: unknown;
  normalizedUsdMax?: unknown;
  category?: unknown;
  skills?: unknown;
  isRemote?: unknown;
  workplaceType?: unknown;
  direction?: unknown;
  publishedAt?: unknown;
  createdAt?: unknown;
  score?: unknown;
  verdict?: unknown;
  gates?: unknown;
  checks?: unknown;
  sourceRef?: unknown;
  contacts?: unknown;
  [key: string]: unknown;
}

export interface OpenRadarQuery {
  keywords?: string[];
  type?: "job" | "gig";
  skill?: string;
  budget?: number;
  language?: "ru" | "en";
  remote?: boolean;
  workplace?: "remote" | "hybrid" | "onsite";
  direction?: string;
  it?: boolean;
  sort?: "new" | "score" | "budget" | "relevance";
  limit?: number;
  page?: number;
}

function text(value: unknown, max = MAX_TEXT): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).replace(/\s+/g, " ").trim().slice(0, max);
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function bool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function httpUrl(value: unknown): string | undefined {
  const candidate = text(value, 2_000);
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => text(item, 120)).filter(Boolean).slice(0, 100)
    : [];
}

function objectOrUndefined(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function normaliseOpenRadarPayload(payload: unknown): OpenRadarLead[] {
  if (Array.isArray(payload)) {
    return payload
      .slice(0, MAX_ROWS)
      .filter((row): row is OpenRadarLead => Boolean(row && typeof row === "object" && !Array.isArray(row)));
  }
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["items", "leads", "data", "results"]) {
    if (Array.isArray(record[key])) {
      return normaliseOpenRadarPayload(record[key]);
    }
  }
  return [];
}

function toJob(row: OpenRadarLead, fetchedAt: string): Job | undefined {
  const title = text(row.title, 240);
  const link = httpUrl(row.canonicalUrl) || httpUrl(row.url);
  if (!title || !link) return undefined;

  const type = row.type === "gig" ? "gig" : "job";
  const description = text(row.text, MAX_TEXT) || title;
  const publishedAt = text(row.publishedAt || row.createdAt, 100) || fetchedAt;
  const skills = stringArray(row.skills);
  const rawBudget = text(row.rawSalary, 180);
  const numericMin = number(row.normalizedUsdMin);
  const numericMax = number(row.normalizedUsdMax);
  const budget = rawBudget ||
    (numericMin !== undefined || numericMax !== undefined
      ? `${numericMin ?? "?"}–${numericMax ?? "?"} USD`
      : row.budget !== undefined
        ? `${text(row.budget)}${text(row.currency) ? ` ${text(row.currency)}` : ""}`
        : undefined);

  return {
    id: jobId("openradar", text(row.id, 300) || link),
    platform: "openradar",
    kind: type,
    title,
    description,
    link,
    date: publishedAt,
    budget,
    fetchedAt,
    raw: {
      source: "openradar_api",
      sourceId: text(row.id, 300),
      author: text(row.author, 200),
      city: text(row.city, 200),
      currency: text(row.currency, 20),
      paymentPeriod: text(row.paymentPeriod, 40),
      category: text(row.category, 120),
      skills,
      remote: bool(row.isRemote),
      workplace: text(row.workplaceType, 40),
      direction: text(row.direction, 120),
      score: number(row.score),
      verdict: text(row.verdict, 40),
      gates: Array.isArray(row.gates) ? row.gates : undefined,
      checks: Array.isArray(row.checks) ? row.checks : undefined,
      sourceRef: objectOrUndefined(row.sourceRef),
      // The guest API normally omits contacts. Preserve only the fact that a
      // response supplied a contacts field, never copy contact values into the
      // Workix card or logs.
      contactsAvailable: Array.isArray(row.contacts) && row.contacts.length > 0,
    },
  };
}

function queryUrl(opts?: OpenRadarQuery): string {
  const url = new URL(OPENRADAR_API_URL);
  const keywords = (opts?.keywords || []).map((value) => value.trim()).filter(Boolean);
  if (keywords.length) url.searchParams.set("q", keywords.join(" "));
  if (opts?.type) url.searchParams.set("type", opts.type);
  if (opts?.skill) url.searchParams.set("skill", opts.skill.trim());
  if (opts?.budget !== undefined && Number.isFinite(opts.budget)) {
    url.searchParams.set("budget", String(opts.budget));
  }
  if (opts?.language) url.searchParams.set("language", opts.language);
  if (opts?.remote) url.searchParams.set("remote", "1");
  if (opts?.workplace) url.searchParams.set("workplace", opts.workplace);
  if (opts?.direction) url.searchParams.set("direction", opts.direction.trim());
  if (opts?.it) url.searchParams.set("it", "1");
  if (opts?.sort) url.searchParams.set("sort", opts.sort);
  const limit = Math.min(Math.max(Math.floor(opts?.limit ?? 50), 1), MAX_ROWS);
  url.searchParams.set("limit", String(limit));
  if (opts?.page !== undefined) {
    url.searchParams.set("page", String(Math.max(Math.floor(opts.page), 1)));
  }
  return url.toString();
}

export function buildOpenRadarUrl(opts?: OpenRadarQuery): string {
  return queryUrl(opts);
}

export async function fetchOpenRadarJobs(
  opts?: OpenRadarQuery,
): Promise<{ jobs: Job[]; error?: string }> {
  const { data, error, status } = await fetchJson<unknown>(queryUrl(opts), {
    headers: {
      Accept: "application/json",
      "User-Agent": "WorkixMCP/1.0 (read-only OpenRadar feed)",
    },
    proxy: false,
  });
  if (error || data === undefined) {
    return { jobs: [], error: error || `OpenRadar HTTP ${status}` };
  }

  const rows = normaliseOpenRadarPayload(data);
  const fetchedAt = new Date().toISOString();
  const jobs = rows.map((row) => toJob(row, fetchedAt)).filter(Boolean) as Job[];
  return {
    jobs,
    error: jobs.length || rows.length ? undefined : "OpenRadar API returned no valid leads",
  };
}

export const _openRadarInternals = { toJob };

