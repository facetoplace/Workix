import { refreshJobs } from "../fetchJobs.js";
import { checkJobsAlive } from "../freshness.js";
import { getPreset } from "../presets.js";
import { parseProfileFilters } from "../profile.js";
import { cardSummary, digestText, filterJobs } from "../summarize.js";
import {
  contactedKeys,
  markDigestShown,
  normalizeLink,
  wasShownInDigest,
} from "../store.js";
import { runShareJobs } from "./share_jobs.js";
import { runOpenWatchSource } from "./watch.js";

export async function runDigest(args: {
  hours?: number;
  keywords?: string[];
  minus?: string[];
  platforms?: string[];
  limit?: number;
  only_new?: boolean;
  preset?: string;
  include_jobs?: boolean;
  include_agent_gigs?: boolean;
  include_services?: boolean;
  use_profile_filters?: boolean;
  /** Batch-share digest cards to Workix hub (no per-item confirm). Needs WORKIX_AGENT_KEY. */
  share_to_hub?: boolean;
  /** Ignore the shared fetch cache and re-read every source from the network. */
  force_refresh?: boolean;
  /** Keep cards already logged in outreach. Default false — they are dropped. */
  include_contacted?: boolean;
  /** Verify shortlisted links still resolve to a live posting. Default true. */
  verify_links?: boolean;
}): Promise<unknown> {
  const preset = args.preset ? getPreset(args.preset) : undefined;
  const profile = args.use_profile_filters === false ? null : parseProfileFilters();

  const hours = args.hours ?? preset?.hours ?? 12;
  const limit = args.limit ?? preset?.limit ?? 20;
  const onlyNew = args.only_new !== false;
  const keywords =
    args.keywords ??
    preset?.keywords ??
    (profile?.keywords.length ? profile.keywords : undefined);
  const minus =
    args.minus ??
    preset?.minus ??
    (profile?.minus.length ? profile.minus : undefined);
  const include_jobs =
    args.include_jobs ?? preset?.include_jobs ?? false;
  const include_agent_gigs = args.include_agent_gigs ?? false;
  const include_services =
    args.include_services ?? preset?.include_services ?? false;

  const platforms = args.platforms ?? preset?.platforms;

  const hh_text = keywords?.slice(0, 5).join(" ") || undefined;
  const upwork_query = keywords?.slice(0, 6).join(" OR ") || undefined;
  const freelancer_query = upwork_query;

  const { jobs, errors, cached } = await refreshJobs({
    platforms,
    include_jobs,
    include_agent_gigs,
    hh_text,
    upwork_query,
    freelancer_query,
    keywords,
    force_refresh: args.force_refresh,
  });

  const strong = preset?.strong;

  let filtered = filterJobs(jobs, {
    hours,
    keywords,
    minus,
    platforms,
    strong,
    min_budget: profile?.min_budget,
  });

  if (onlyNew) {
    filtered = filtered.filter((j) => !wasShownInDigest(j.id));
  }

  // Never resurface something already written to. The user contacts people
  // outside these tools too, so this reads the whole outreach log, not just
  // rows this session created.
  let dropped_contacted = 0;
  if (!args.include_contacted) {
    const contacted = contactedKeys();
    const before = filtered.length;
    filtered = filtered.filter((j) => {
      const link = normalizeLink(j.link);
      return !(contacted.has(j.id) || (link && contacted.has(link)));
    });
    dropped_contacted = before - filtered.length;
  }

  // Boards keep serving removed postings (4dayweek 200s on its homepage), so
  // verify the links we are about to show. Only the shortlist, to stay cheap.
  let dropped_dead = 0;
  let dead_links: Array<{ title: string; link: string; reason?: string }> = [];
  if (args.verify_links !== false) {
    const shortlist = filtered.slice(0, limit * 2);
    const live = await checkJobsAlive(shortlist, { limit: limit * 2 });
    const dead = new Set<string>();
    for (const j of shortlist) {
      const r = live.get(j.id);
      if (r?.state === "gone") {
        dead.add(j.id);
        dead_links.push({ title: j.title, link: j.link, reason: r.reason });
      }
    }
    if (dead.size) {
      filtered = filtered.filter((j) => !dead.has(j.id));
      dropped_dead = dead.size;
    }
  }

  const top = filtered.slice(0, limit);
  const cards = top.map((j) => cardSummary(j, keywords));
  markDigestShown(top.map((j) => j.id));

  const summary = digestText(cards, {
    hours,
    errors,
    preset: args.preset,
  });

  let watch: unknown;
  if (include_services || (preset?.watch_sources?.length && args.preset === "startups_products")) {
    const sources = preset?.watch_sources || [
      "profi",
      "avito",
      "youdo",
      "fiverr",
      "sproutgigs",
      "product_radar",
      "startupfellows",
    ];
    watch = {
      hint: "Полуручной watch — открой через workix_open_watch_source",
      sources: await Promise.all(
        sources.map((id) => runOpenWatchSource({ source: id })),
      ),
    };
  }

  let hub_share: unknown;
  if (args.share_to_hub) {
    if (!process.env.WORKIX_AGENT_KEY && !process.env.WORKIX_API_KEY) {
      hub_share = {
        ok: false,
        error: "WORKIX_AGENT_KEY missing — digest ran, but hub share skipped",
      };
    } else if (!top.length) {
      hub_share = { ok: true, shared: 0, created: [], skipped: [], errors: [] };
    } else {
      hub_share = await runShareJobs({ jobs: top });
    }
  }

  return {
    summary,
    count: cards.length,
    total_matched: filtered.length,
    cards,
    errors,
    // Which sources came from the shared cache instead of the network, with age.
    ...(cached.length ? { served_from_cache: cached } : {}),
    ...(dropped_dead ? { dropped_dead, dead_links } : {}),
    // Silent filtering reads as "nothing was out there" — say what was cut.
    ...(dropped_contacted
      ? {
          dropped_contacted,
          dropped_note:
            "Скрыто как уже отработанное (outreach). include_contacted:true — показать.",
        }
      : {}),
    filters: {
      keywords,
      strong,
      minus,
      include_jobs,
      include_agent_gigs,
      include_services,
      hours,
      share_to_hub: !!args.share_to_hub,
      include_contacted: !!args.include_contacted,
    },
    watch,
    ...(hub_share != null ? { hub_share } : {}),
  };
}
