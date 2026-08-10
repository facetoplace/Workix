import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchGetOnBrdJobs } from "../adapters/getonbrd.js";

export const meta: AdapterMeta = {
  id: "getonbrd",
  version: "1.0.0",
  platforms: ["getonbrd"],
  envKeys: ["GETONBRD_QUERY", "GETONBRD_REMOTE_ONLY"],
};

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  const kw = Array.isArray(opts?.keywords) ? (opts.keywords as string[]) : [];
  return fetchGetOnBrdJobs({
    query: typeof opts?.query === "string" ? opts.query : kw.join(" ") || undefined,
  });
}
