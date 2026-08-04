import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { adzunaConfigured, fetchAdzunaJobs } from "../adapters/adzuna.js";

export const meta: AdapterMeta = {
  id: "adzuna",
  version: "1.0.0",
  platforms: ["adzuna"],
  envKeys: ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"],
};

export function configured() {
  return adzunaConfigured();
}

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  return fetchAdzunaJobs({
    what: typeof opts?.what === "string" ? opts.what : undefined,
    country: typeof opts?.country === "string" ? opts.country : undefined,
    page: typeof opts?.page === "number" ? opts.page : undefined,
  });
}
