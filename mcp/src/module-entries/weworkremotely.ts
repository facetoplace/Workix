import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchWeWorkRemotelyJobs } from "../adapters/weworkremotely.js";

export const meta: AdapterMeta = {
  id: "weworkremotely",
  version: "1.0.0",
  platforms: ["weworkremotely"],
};

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  return fetchWeWorkRemotelyJobs({
    category:
      typeof opts?.category === "string" ? opts.category : undefined,
  });
}
