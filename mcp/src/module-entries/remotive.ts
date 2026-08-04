import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchRemotiveJobs } from "../adapters/remotive.js";

export const meta: AdapterMeta = {
  id: "remotive",
  version: "1.0.0",
  platforms: ["remotive"],
};

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  return fetchRemotiveJobs({
    category: typeof opts?.category === "string" ? opts.category : undefined,
  });
}
