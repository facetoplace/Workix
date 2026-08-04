import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchHimalayasJobs } from "../adapters/himalayas.js";

export const meta: AdapterMeta = {
  id: "himalayas",
  version: "1.0.0",
  platforms: ["himalayas"],
};

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  return fetchHimalayasJobs({
    limit: typeof opts?.limit === "number" ? opts.limit : undefined,
    pages: typeof opts?.pages === "number" ? opts.pages : undefined,
  });
}
