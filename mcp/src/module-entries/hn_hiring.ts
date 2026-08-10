import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchHnHiringJobs } from "../adapters/hn_hiring.js";

export const meta: AdapterMeta = {
  id: "hn_hiring",
  version: "1.0.0",
  platforms: ["hn_hiring"],
  envKeys: ["HN_HIRING_STORY"],
};

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  return fetchHnHiringJobs({
    keywords: Array.isArray(opts?.keywords)
      ? (opts.keywords as unknown[]).filter((k): k is string => typeof k === "string")
      : undefined,
    limit: typeof opts?.limit === "number" ? opts.limit : undefined,
    storyId: typeof opts?.storyId === "string" ? opts.storyId : undefined,
  });
}
