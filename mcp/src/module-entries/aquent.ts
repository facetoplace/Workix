import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchAquentJobs } from "../adapters/aquent.js";

export const meta: AdapterMeta = {
  id: "aquent",
  version: "1.0.0",
  platforms: ["aquent"],
  envKeys: ["AQUENT_REMOTE_ONLY"],
};

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  return fetchAquentJobs({
    count: typeof opts?.count === "number" ? opts.count : undefined,
    remoteOnly:
      typeof opts?.remoteOnly === "boolean" ? opts.remoteOnly : undefined,
  });
}
