import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchUsaJobs, usajobsConfigured } from "../adapters/usajobs.js";

export const meta: AdapterMeta = {
  id: "usajobs",
  version: "1.0.0",
  platforms: ["usajobs"],
  envKeys: [
    "USAJOBS_API_KEY",
    "USAJOBS_EMAIL",
    "USAJOBS_KEYWORD",
    "USAJOBS_REMOTE_ONLY",
  ],
};

export function configured(): boolean {
  return usajobsConfigured();
}

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  const kw = Array.isArray(opts?.keywords) ? (opts.keywords as string[]) : [];
  return fetchUsaJobs({
    keyword:
      typeof opts?.keyword === "string" ? opts.keyword : kw.join(" ") || undefined,
  });
}
