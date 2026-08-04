import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchWorkingNomadsJobs } from "../adapters/working_nomads.js";

export const meta: AdapterMeta = {
  id: "working_nomads",
  version: "1.0.0",
  platforms: ["working_nomads"],
};

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  return fetchWorkingNomadsJobs({
    category: typeof opts?.category === "string" ? opts.category : undefined,
  });
}
