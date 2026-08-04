import { fetchText } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

const BASE = "https://find.dreamoffer.app";

/** Compact row from initial-dataset pages_payload.pages[N] */
type DoRow = unknown[];

interface DoVacancyInfo {
  profession?: string;
  grade?: string;
  work_format?: string;
  employment_type?: string;
  language?: string;
  country?: string | null;
  city?: string | null;
  salary?: { raw?: string; currency?: string; min?: number | null; max?: number | null };
}

interface DoSsr {
  nn?: number;
  link?: string;
  source?: string;
  vacancy_text?: string;
  time_of_created?: string;
  time_in_channel?: string;
  tg_name_channel?: string;
  vacancy_info?: DoVacancyInfo;
}

function headers(lang: string): Record<string, string> {
  return {
    Accept: "application/json, text/html;q=0.9",
    "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
    "X-Lang": lang,
    Referer: `${BASE}/`,
    Origin: BASE,
  };
}

function titleFromText(text: string): string {
  const line = text
    .replace(/\*\*/g, "")
    .split("\n")
    .map((s) => s.trim())
    .find(Boolean);
  return (line || "Dream Offer vacancy").slice(0, 200);
}

function rowToJob(row: DoRow): Job | null {
  if (!Array.isArray(row) || row.length < 11) return null;
  const nn = Number(row[0]);
  if (!Number.isFinite(nn)) return null;
  const link = String(row[7] || "").trim();
  const text = String(row[10] || "");
  const info = (row[12] || {}) as DoVacancyInfo;
  const source = String(row[6] || "");
  const created = String(row[3] || row[2] || "");
  const channel = String(row[9] || "");
  const dreamUrl = `${BASE}/vacancy.html?nn=${nn}`;
  const budget = info.salary?.raw || undefined;
  const prof = info.profession || "";
  const grade = info.grade && info.grade !== "unknown" ? info.grade : "";
  const titleBits = [titleFromText(text), prof && `(${prof})`, grade].filter(Boolean);
  return {
    id: jobId("dreamoffer", dreamUrl),
    platform: "dreamoffer",
    kind: "job",
    title: titleBits.join(" "),
    description: text.replace(/\s+/g, " ").trim().slice(0, 4000),
    link: dreamUrl,
    date: created ? new Date(created).toISOString() : new Date().toISOString(),
    budget,
    fetchedAt: new Date().toISOString(),
    raw: {
      nn,
      source,
      source_link: link || undefined,
      channel,
      profession: info.profession,
      grade: info.grade,
      work_format: info.work_format,
      employment_type: info.employment_type,
      country: info.country,
      city: info.city,
      language: info.language,
      apply: "source", // Dream Offer has no native apply — open source_link
    },
  };
}

function ssrToJob(v: DoSsr): Job | null {
  const nn = Number(v.nn);
  if (!Number.isFinite(nn)) return null;
  const text = String(v.vacancy_text || "");
  const info = v.vacancy_info || {};
  const dreamUrl = `${BASE}/vacancy.html?nn=${nn}`;
  const created = v.time_of_created || v.time_in_channel || "";
  const prof = info.profession || "";
  const grade = info.grade && info.grade !== "unknown" ? info.grade : "";
  return {
    id: jobId("dreamoffer", dreamUrl),
    platform: "dreamoffer",
    kind: "job",
    title: [titleFromText(text), prof && `(${prof})`, grade].filter(Boolean).join(" "),
    description: text.replace(/\s+/g, " ").trim().slice(0, 4000),
    link: dreamUrl,
    date: created ? new Date(created).toISOString() : new Date().toISOString(),
    budget: info.salary?.raw || undefined,
    fetchedAt: new Date().toISOString(),
    raw: {
      nn,
      source: v.source,
      source_link: v.link,
      channel: v.tg_name_channel,
      profession: info.profession,
      grade: info.grade,
      work_format: info.work_format,
      apply: "source",
    },
  };
}

function matchesFilters(
  job: Job,
  opts: {
    profession?: string;
    workFormat?: string;
    keywords?: string[];
  },
): boolean {
  const raw = (job.raw || {}) as Record<string, unknown>;
  const hay = `${job.title}\n${job.description}\n${raw.profession || ""}\n${raw.grade || ""}`.toLowerCase();

  if (opts.workFormat && opts.workFormat !== "all") {
    const wf = String(raw.work_format || "").toLowerCase();
    if (wf && wf !== "unknown" && wf !== opts.workFormat.toLowerCase()) return false;
  }

  if (opts.profession && opts.profession !== "all") {
    const want = opts.profession.toLowerCase();
    const prof = String(raw.profession || "").toLowerCase();
    const mobileAliases =
      want === "mobile" || want === "developer mobile" || want === "mobile developer";
    if (mobileAliases) {
      // Prefer tagged profession / title — body text alone is too noisy (QA, ASO, …)
      const titleHay = job.title.toLowerCase();
      const profOk = /\bmobile\b/.test(prof);
      const titleOk =
        /\b(mobile|flutter|android|swift|kotlin|kmp)\b|react\s*native|\bios\b/.test(
          titleHay,
        );
      if (!profOk && !titleOk) return false;
    } else if (prof && !prof.includes(want) && !hay.includes(want)) {
      return false;
    }
  }

  if (opts.keywords?.length) {
    const ok = opts.keywords.some((k) => hay.includes(k.toLowerCase()));
    if (!ok) return false;
  }
  return true;
}

async function fetchInitialDataset(lang: string): Promise<{
  pages: DoRow[];
  nn: number[];
  error?: string;
}> {
  const res = await fetchText(`${BASE}/initial-dataset`, {
    headers: headers(lang),
    proxy: false,
    timeoutMs: 45000,
  });
  if (!res.ok) {
    return { pages: [], nn: [], error: `Dream Offer initial-dataset HTTP ${res.status}` };
  }
  try {
    const data = JSON.parse(res.text) as {
      ok?: boolean;
      pages_payload?: { pages?: Record<string, DoRow[]> };
      nn_payload?: { nn?: number[] };
    };
    const pageMap = data.pages_payload?.pages || {};
    const pages: DoRow[] = [];
    // Prefer newest pages first (1, 2, …) then last
    const keys = Object.keys(pageMap).sort((a, b) => {
      if (a === "last") return 1;
      if (b === "last") return -1;
      return Number(a) - Number(b);
    });
    for (const k of keys) {
      const chunk = pageMap[k];
      if (Array.isArray(chunk)) pages.push(...chunk);
    }
    return {
      pages,
      nn: Array.isArray(data.nn_payload?.nn) ? data.nn_payload!.nn! : [],
    };
  } catch (e) {
    return { pages: [], nn: [], error: `Dream Offer JSON: ${(e as Error).message}` };
  }
}

async function fetchVacancySsr(nn: number, lang: string): Promise<Job | null> {
  const res = await fetchText(`${BASE}/vacancy.html?nn=${nn}`, {
    headers: { ...headers(lang), Accept: "text/html" },
    proxy: false,
    timeoutMs: 20000,
  });
  if (!res.ok) return null;
  const m = res.text.match(/__VACANCY_SSR__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/);
  if (!m) return null;
  try {
    return ssrToJob(JSON.parse(m[1]) as DoSsr);
  } catch {
    return null;
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R | null>,
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      const r = await fn(items[idx]!);
      if (r != null) out.push(r);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return out;
}

/**
 * Dream Offer (find.dreamoffer.app) — IT/digital job aggregator.
 * Search: public GET /initial-dataset (+ optional vacancy.html SSR scan).
 * Apply: no native bid API — open source_link (TG / LinkedIn / ATS) via browser after user ok.
 */
export async function fetchDreamOfferJobs(opts?: {
  limit?: number;
  profession?: string;
  workFormat?: string;
  keywords?: string[];
  lang?: string;
  /** Extra nn ids to hydrate via vacancy.html when page cache is thin (default 40). */
  scanExtra?: number;
}): Promise<{ jobs: Job[]; error?: string }> {
  const limit = Math.min(Math.max(opts?.limit ?? 30, 1), 80);
  const lang = (opts?.lang || process.env.DREAMOFFER_LANG || "ru").trim() || "ru";
  const profession =
    opts?.profession?.trim() ||
    process.env.DREAMOFFER_PROFESSION?.trim() ||
    "Mobile";
  const workFormat =
    opts?.workFormat?.trim() ||
    process.env.DREAMOFFER_WORK_FORMAT?.trim() ||
    "remote";
  const scanExtra = Math.min(
    Math.max(
      opts?.scanExtra ??
        (process.env.DREAMOFFER_SCAN_EXTRA
          ? Number(process.env.DREAMOFFER_SCAN_EXTRA)
          : 40),
      0,
    ),
    120,
  );

  const { pages, nn, error } = await fetchInitialDataset(lang);
  if (error && !pages.length) return { jobs: [], error };

  const filters = {
    profession: profession || undefined,
    workFormat: workFormat || undefined,
    keywords: opts?.keywords,
  };

  const seen = new Set<string>();
  const jobs: Job[] = [];

  for (const row of pages) {
    const job = rowToJob(row);
    if (!job || seen.has(job.id)) continue;
    if (!matchesFilters(job, filters)) continue;
    seen.add(job.id);
    jobs.push(job);
    if (jobs.length >= limit) break;
  }

  if (jobs.length < limit && scanExtra > 0 && nn.length) {
    const pageNns = new Set(
      pages.map((r) => Number(Array.isArray(r) ? r[0] : NaN)).filter(Number.isFinite),
    );
    const toScan = nn.filter((id) => !pageNns.has(id)).slice(0, scanExtra);
    const hydrated = await mapPool(toScan, 8, async (id) => {
      const job = await fetchVacancySsr(id, lang);
      if (!job || seen.has(job.id)) return null;
      if (!matchesFilters(job, filters)) return null;
      return job;
    });
    for (const job of hydrated) {
      if (seen.has(job.id)) continue;
      seen.add(job.id);
      jobs.push(job);
      if (jobs.length >= limit) break;
    }
  }

  jobs.sort((a, b) => b.date.localeCompare(a.date));
  return {
    jobs: jobs.slice(0, limit),
    ...(error ? { error } : {}),
  };
}
