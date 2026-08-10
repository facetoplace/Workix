import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchNoFluffJobs } from "../adapters/nofluff.js";

export const meta: AdapterMeta = {
  id: "nofluff",
  version: "1.0.0",
  platforms: ["nofluff"],
  envKeys: ["NOFLUFF_CATEGORY", "NOFLUFF_REGION", "NOFLUFF_REMOTE_ONLY"],
};

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  return fetchNoFluffJobs({
    category: typeof opts?.category === "string" ? opts.category : undefined,
    keywords: Array.isArray(opts?.keywords)
      ? (opts.keywords as string[])
      : undefined,
    limit: typeof opts?.limit === "number" ? opts.limit : undefined,
  });
}
