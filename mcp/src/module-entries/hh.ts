import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchHhJobs } from "../adapters/hh.js";

export const meta: AdapterMeta = {
  id: "hh",
  version: "1.0.0",
  platforms: ["hh"],
  envKeys: ["HH_USER_AGENT", "HH_APP_TOKEN"],
};

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: { text?: string; pages?: number },
) {
  return fetchHhJobs(opts);
}
