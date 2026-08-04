import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchTheMuseJobs } from "../adapters/themuse.js";

export const meta: AdapterMeta = {
  id: "themuse",
  version: "1.0.0",
  platforms: ["themuse"],
};

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  return fetchTheMuseJobs({
    pages: typeof opts?.pages === "number" ? opts.pages : undefined,
    category: typeof opts?.category === "string" ? opts.category : undefined,
  });
}
