import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import {
  fetchSuperJobJobs,
  superjobConfigured,
} from "../adapters/superjob.js";

export const meta: AdapterMeta = {
  id: "superjob",
  version: "1.0.0",
  platforms: ["superjob"],
  envKeys: [
    "SUPERJOB_APP_ID",
    "SUPERJOB_KEYWORD",
    "SUPERJOB_TOWN",
    "SUPERJOB_REMOTE_ONLY",
  ],
};

export function configured(): boolean {
  return superjobConfigured();
}

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  const kw = Array.isArray(opts?.keywords) ? (opts.keywords as string[]) : [];
  return fetchSuperJobJobs({
    keyword:
      typeof opts?.keyword === "string" ? opts.keyword : kw.join(" ") || undefined,
  });
}
