import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchRentAHumanJobs } from "../adapters/rentahuman.js";

export const meta: AdapterMeta = {
  id: "rentahuman",
  version: "1.0.0",
  platforms: ["rentahuman"],
};

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  return fetchRentAHumanJobs({
    limit: typeof opts?.limit === "number" ? opts.limit : undefined,
    pages: typeof opts?.pages === "number" ? opts.pages : undefined,
  });
}
