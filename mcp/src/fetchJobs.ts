import { CORE_RSS_PLATFORMS } from "./adapterModule.js";
import { callFetchJobs, ensurePlatforms } from "./adapterLoader.js";
import { fetchRssJobs } from "./adapters/rss.js";
import { upsertJobs } from "./store.js";
import type { Job } from "./types.js";

function softError(err?: string): boolean {
  if (!err) return true;
  return err.includes("optional") || err.includes("missing");
}

export async function refreshJobs(opts?: {
  platforms?: string[];
  includeKwork?: boolean;
  include_jobs?: boolean;
  include_freelancehunt?: boolean;
  include_upwork?: boolean;
  include_freelancer?: boolean;
  hh_text?: string;
  upwork_query?: string;
  freelancer_query?: string;
}): Promise<{
  jobs: Job[];
  errors: string[];
}> {
  const platforms = opts?.platforms;
  const errors: string[] = [];
  const collected: Job[] = [];

  const wantRss =
    !platforms?.length ||
    platforms.some((p) => (CORE_RSS_PLATFORMS as readonly string[]).includes(p));
  const rssIds = platforms?.filter((p) =>
    (CORE_RSS_PLATFORMS as readonly string[]).includes(p),
  );

  if (wantRss) {
    const rss = await fetchRssJobs(rssIds?.length ? rssIds : undefined);
    collected.push(...rss.jobs);
    for (const e of rss.errors) errors.push(`${e.platform}: ${e.error}`);
  }

  const modulesWanted: string[] = [];
  const wantKwork =
    opts?.includeKwork !== false &&
    (!platforms?.length || platforms.includes("kwork"));
  if (wantKwork) modulesWanted.push("kwork");

  const wantFh =
    opts?.include_freelancehunt !== false &&
    (!platforms?.length || platforms.includes("freelancehunt"));
  if (wantFh) modulesWanted.push("freelancehunt");

  if (opts?.include_jobs) {
    if (!platforms?.length || platforms.includes("hh")) modulesWanted.push("hh");
    if (!platforms?.length || platforms.includes("remoteok")) {
      modulesWanted.push("remoteok");
    }
  }

  const wantUpwork =
    opts?.include_upwork !== false &&
    (!platforms?.length || platforms.includes("upwork"));
  if (wantUpwork) modulesWanted.push("upwork");

  const wantFln =
    opts?.include_freelancer !== false &&
    (!platforms?.length || platforms.includes("freelancer_com"));
  if (wantFln) modulesWanted.push("freelancer_com");

  if (modulesWanted.length) {
    const ensured = await ensurePlatforms(modulesWanted);
    for (const e of ensured.errors) errors.push(`adapter: ${e}`);
  }

  if (wantKwork) {
    const kw = await callFetchJobs("kwork");
    collected.push(...kw.jobs);
    if (kw.error && !softError(kw.error)) errors.push(`kwork: ${kw.error}`);
  }

  if (wantFh) {
    const fh = await callFetchJobs("freelancehunt");
    collected.push(...fh.jobs);
    if (fh.error && !softError(fh.error)) {
      errors.push(`freelancehunt: ${fh.error}`);
    }
  }

  if (opts?.include_jobs) {
    if (!platforms?.length || platforms.includes("hh")) {
      const hh = await callFetchJobs("hh", { text: opts.hh_text });
      collected.push(...hh.jobs);
      if (hh.error) errors.push(`hh: ${hh.error}`);
    }
    if (!platforms?.length || platforms.includes("remoteok")) {
      const rok = await callFetchJobs("remoteok");
      collected.push(...rok.jobs);
      if (rok.error) errors.push(`remoteok: ${rok.error}`);
    }
  }

  if (wantUpwork) {
    const uw = await callFetchJobs("upwork", { query: opts?.upwork_query });
    collected.push(...uw.jobs);
    if (uw.error && !softError(uw.error)) errors.push(`upwork: ${uw.error}`);
  }

  if (wantFln) {
    const fln = await callFetchJobs("freelancer", {
      query: opts?.freelancer_query,
    });
    collected.push(...fln.jobs);
    if (fln.error && !softError(fln.error)) {
      errors.push(`freelancer_com: ${fln.error}`);
    }
  }

  const stored = upsertJobs(collected);
  return { jobs: stored, errors };
}
