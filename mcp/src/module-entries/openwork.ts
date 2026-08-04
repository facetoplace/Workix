import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchOpenworkJobs } from "../adapters/openwork.js";

export const meta: AdapterMeta = {
  id: "openwork",
  version: "1.0.0",
  platforms: ["openwork"],
};

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  return fetchOpenworkJobs({
    openOnly: typeof opts?.openOnly === "boolean" ? opts.openOnly : undefined,
  });
}
