import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchLandingJobs } from "../adapters/landing_jobs.js";

export const meta: AdapterMeta = {
  id: "landing_jobs",
  version: "1.0.0",
  platforms: ["landing_jobs"],
  envKeys: ["LANDING_JOBS_REMOTE_ONLY"],
};

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  return fetchLandingJobs({
    keywords: Array.isArray(opts?.keywords)
      ? (opts.keywords as string[])
      : undefined,
  });
}
