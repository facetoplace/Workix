import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchJoobleJobs, joobleConfigured } from "../adapters/jooble.js";

export const meta: AdapterMeta = {
  id: "jooble",
  version: "1.0.0",
  platforms: ["jooble"],
  envKeys: ["JOOBLE_API_KEY", "JOOBLE_KEYWORDS", "JOOBLE_LOCATION"],
};

export function configured(): boolean {
  return joobleConfigured();
}

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  const kw = Array.isArray(opts?.keywords) ? (opts.keywords as string[]) : [];
  return fetchJoobleJobs({
    keywords:
      typeof opts?.query === "string" ? opts.query : kw.join(" ") || undefined,
  });
}
