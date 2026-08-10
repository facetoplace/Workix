import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchTrudvsemJobs } from "../adapters/trudvsem.js";

export const meta: AdapterMeta = {
  id: "trudvsem",
  version: "1.0.0",
  platforms: ["trudvsem"],
  envKeys: ["TRUDVSEM_TEXT", "TRUDVSEM_REGION"],
};

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  return fetchTrudvsemJobs({
    text: typeof opts?.text === "string" ? opts.text : undefined,
    keywords: Array.isArray(opts?.keywords)
      ? (opts.keywords as string[])
      : undefined,
    region: typeof opts?.region === "string" ? opts.region : undefined,
    limit: typeof opts?.limit === "number" ? opts.limit : undefined,
  });
}
