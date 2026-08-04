import { refreshJobs } from "../fetchJobs.js";
import { parseProfileFilters } from "../profile.js";
import { cardSummary, filterJobs } from "../summarize.js";
import { listJobs } from "../store.js";

export async function runSearch(args: {
  keywords?: string[];
  minus?: string[];
  platforms?: string[];
  since?: string;
  hours?: number;
  limit?: number;
  offset?: number;
  refresh?: boolean;
  include_jobs?: boolean;
  include_agent_gigs?: boolean;
}): Promise<unknown> {
  const limit = args.limit ?? 20;
  const offset = args.offset ?? 0;
  const profile = parseProfileFilters();
  const keywords = args.keywords ?? (profile.keywords.length ? profile.keywords : undefined);
  const minus = args.minus ?? (profile.minus.length ? profile.minus : undefined);

  if (args.refresh !== false) {
    const q = keywords?.slice(0, 6).join(" OR ");
    await refreshJobs({
      platforms: args.platforms,
      include_jobs: args.include_jobs,
      include_agent_gigs: args.include_agent_gigs,
      hh_text: keywords?.slice(0, 5).join(" "),
      upwork_query: q,
      freelancer_query: q,
    });
  }

  const filtered = filterJobs(listJobs(), {
    hours: args.hours,
    since: args.since,
    keywords,
    minus,
    platforms: args.platforms,
    min_budget: profile.min_budget,
  });

  const page = filtered.slice(offset, offset + limit);
  return {
    total: filtered.length,
    offset,
    limit,
    results: page.map((j) => cardSummary(j, keywords)),
  };
}
