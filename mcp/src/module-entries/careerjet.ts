import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import {
  careerjetConfigured,
  fetchCareerjetJobs,
} from "../adapters/careerjet.js";

export const meta: AdapterMeta = {
  id: "careerjet",
  version: "1.0.0",
  platforms: ["careerjet"],
  envKeys: [
    "CAREERJET_AFFID",
    "CAREERJET_LOCALE",
    "CAREERJET_KEYWORDS",
    "CAREERJET_LOCATION",
    "CAREERJET_REFERER",
  ],
};

export function configured(): boolean {
  return careerjetConfigured();
}

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  const kw = Array.isArray(opts?.keywords) ? (opts.keywords as string[]) : [];
  return fetchCareerjetJobs({
    keywords:
      typeof opts?.query === "string" ? opts.query : kw.join(" ") || undefined,
  });
}
