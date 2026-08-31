/**
 * Collect → search, as two explicit phases.
 *
 *  workix_collect     — ingest every source into the store. HTTP/RSS/boards/HH
 *                       via refreshJobs and Telegram via a full channel sweep run
 *                       in PARALLEL; nothing is ranked, everything is upserted.
 *  workix_db_search   — rank/filter what's already in the store. No network.
 */
import { refreshJobs } from "../fetchJobs.js";
import { sweepTelegramChannels, telegramActivated } from "../adapters/telegram.js";
import { parseProfileFilters } from "../profile.js";
import { listJobs, listOutreach, upsertJobs } from "../store.js";
import { searchCorpus } from "../searchCorpus.js";

export async function runCollect(args: {
  keywords?: string[];
  include_jobs?: boolean;
  include_agent_gigs?: boolean;
  /** Opt-in: ingest RU browser-profile services (Profi.ru, Avito). Default off. */
  include_services?: boolean;
  tg_days?: number;
  skip_http?: boolean;
  skip_telegram?: boolean;
  force_refresh?: boolean;
}): Promise<unknown> {
  const profile = parseProfileFilters();
  const keywords = args.keywords ?? (profile.keywords.length ? profile.keywords : undefined);
  const q = keywords?.slice(0, 6).join(" OR ");
  const startedAt = Date.now();

  const httpTask = args.skip_http
    ? Promise.resolve(null)
    : refreshJobs({
        include_jobs: args.include_jobs !== false,
        include_agent_gigs: args.include_agent_gigs !== false,
        include_services: args.include_services === true,
        keywords,
        hh_text: keywords?.slice(0, 5).join(" "),
        upwork_query: q,
        freelancer_query: q,
        skip_telegram: true, // Telegram is swept separately, below.
        force_refresh: args.force_refresh,
      }).catch((e) => ({ error: (e as Error)?.message || String(e) } as unknown));

  const tgTask =
    args.skip_telegram || !telegramActivated()
      ? Promise.resolve(null)
      : sweepTelegramChannels({ days: args.tg_days }).catch((e) => ({
          jobs: [],
          channels: 0,
          ok: 0,
          failed: 0,
          errors: [(e as Error)?.message || String(e)],
        }));

  const [http, tg] = await Promise.all([httpTask, tgTask]);

  // refreshJobs already upsert its own; the TG sweep returns jobs to store here.
  let tgAdded = 0;
  if (tg && "jobs" in tg && Array.isArray((tg as { jobs: unknown[] }).jobs)) {
    const jobs = (tg as { jobs: import("../types.js").Job[] }).jobs;
    if (jobs.length) upsertJobs(jobs);
    tgAdded = jobs.length;
  }

  const total = listJobs().length;
  return {
    ok: true,
    phase: "collect",
    ms: Date.now() - startedAt,
    http: http
      ? "jobs" in (http as object)
        ? {
            stored: (http as { jobs?: unknown[] }).jobs?.length ?? 0,
            errors: (http as { errors?: string[] }).errors?.slice(0, 8) ?? [],
            served_from_cache: (http as { cached?: string[] }).cached ?? [],
          }
        : { error: (http as { error?: string }).error }
      : "skipped",
    telegram: tg
      ? {
          channels: (tg as { channels: number }).channels,
          ok: (tg as { ok: number }).ok,
          failed: (tg as { failed: number }).failed,
          pulled: tgAdded,
          errors: (tg as { errors: string[] }).errors,
        }
      : telegramActivated()
        ? "skipped"
        : "not_activated",
    store_total: total,
    hint: "Now query with workix_db_search (no network). Re-run workix_collect to refresh the store.",
  };
}

export async function runDbSearch(args: {
  query?: string;
  keywords?: string[];
  platforms?: string[];
  days?: number;
  hours?: number;
  limit?: number;
  hide_applied?: boolean;
  include_resumes?: boolean;
}): Promise<unknown> {
  const profile = parseProfileFilters();
  const query =
    args.query ??
    (args.keywords?.length
      ? args.keywords.join(" OR ")
      : profile.keywords.length
        ? profile.keywords.join(" OR ")
        : "");

  const cutoffMs =
    args.hours != null
      ? Date.now() - args.hours * 3_600_000
      : Date.now() - Math.min(Math.max(Number(args.days) || 30, 1), 365) * 86_400_000;

  const platforms = args.platforms?.length ? new Set(args.platforms) : null;
  const corpus = listJobs().filter((j) => {
    if (new Date(j.date).getTime() < cutoffMs) return false;
    if (platforms && !platforms.has(j.platform)) return false;
    return true;
  });

  const res = searchCorpus(corpus, listOutreach({ limit: 100 }), {
    query,
    limit: args.limit,
    hide_applied: args.hide_applied,
    drop_resumes: !args.include_resumes,
  });

  return {
    ok: true,
    phase: "search",
    source: "store (no network)",
    query: query || null,
    window: args.hours != null ? `${args.hours}h` : `${Math.min(Math.max(Number(args.days) || 30, 1), 365)}d`,
    corpus_in_window: corpus.length,
    ...res,
    hint: "Postings come from the store as last collected. Run workix_collect to pull fresh ones.",
  };
}
