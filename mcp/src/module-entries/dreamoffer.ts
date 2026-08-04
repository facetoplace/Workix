import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchDreamOfferJobs } from "../adapters/dreamoffer.js";

export const meta: AdapterMeta = {
  id: "dreamoffer",
  version: "1.0.0",
  platforms: ["dreamoffer"],
};

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  return fetchDreamOfferJobs({
    limit: typeof opts?.limit === "number" ? opts.limit : undefined,
    profession: typeof opts?.profession === "string" ? opts.profession : undefined,
    workFormat:
      typeof opts?.workFormat === "string"
        ? opts.workFormat
        : typeof opts?.work_format === "string"
          ? opts.work_format
          : undefined,
    keywords: Array.isArray(opts?.keywords)
      ? opts.keywords.filter((x): x is string => typeof x === "string")
      : undefined,
    lang: typeof opts?.lang === "string" ? opts.lang : undefined,
    scanExtra: typeof opts?.scanExtra === "number" ? opts.scanExtra : undefined,
  });
}
