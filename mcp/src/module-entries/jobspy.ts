import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import {
  JOBSPY_PLATFORMS,
  fetchJobSpyJobs,
  jobspyAvailable,
} from "../adapters/jobspy.js";

/**
 * One module, five boards — all reached through the user's own jobspy install.
 *
 * The list is spelled out rather than referencing JOBSPY_PLATFORMS because
 * scripts/pack-adapters.mjs reads `platforms:` out of this file with a regex
 * and only understands a literal array; a variable silently degrades the
 * registry entry to `["jobspy"]`. Keep in sync with SITE_BY_PLATFORM — the
 * assertion below fails the build if they drift.
 */
export const meta: AdapterMeta = {
  id: "jobspy",
  version: "1.0.3",
  platforms: ["indeed", "glassdoor", "ziprecruiter", "naukri", "bdjobs"],
  envKeys: ["PYTHON_BIN"],
};

if (
  meta.platforms.length !== JOBSPY_PLATFORMS.length ||
  meta.platforms.some((p) => !JOBSPY_PLATFORMS.includes(p))
) {
  throw new Error(
    `jobspy: meta.platforms [${meta.platforms}] out of sync with the adapter [${JOBSPY_PLATFORMS}]`,
  );
}

export async function configured(): Promise<boolean> {
  return jobspyAvailable(process.env);
}

export async function fetchJobs(
  ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  const platform = typeof opts?.platform === "string" ? opts.platform : "indeed";
  return fetchJobSpyJobs({
    env: ctx.env,
    platform,
    what: typeof opts?.what === "string" ? opts.what : undefined,
    location: typeof opts?.location === "string" ? opts.location : undefined,
    hours: typeof opts?.hours === "number" ? opts.hours : undefined,
    limit: typeof opts?.limit === "number" ? opts.limit : undefined,
    proxies: Array.isArray(opts?.proxies)
      ? (opts.proxies as unknown[]).filter((p): p is string => typeof p === "string")
      : undefined,
  });
}
