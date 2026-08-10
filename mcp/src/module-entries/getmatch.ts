import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchGetmatchJobs } from "../adapters/getmatch.js";

export const meta: AdapterMeta = {
  id: "getmatch",
  version: "1.0.0",
  platforms: ["getmatch"],
  envKeys: ["GETMATCH_LIMIT"],
};

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  return fetchGetmatchJobs({
    keywords: Array.isArray(opts?.keywords)
      ? (opts.keywords as unknown[]).filter((k): k is string => typeof k === "string")
      : undefined,
    limit: typeof opts?.limit === "number" ? opts.limit : undefined,
  });
}
