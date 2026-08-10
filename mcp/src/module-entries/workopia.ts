import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchWorkopiaJobs, workopiaConfigured } from "../adapters/workopia.js";

export const meta: AdapterMeta = {
  id: "workopia",
  version: "1.0.0",
  platforms: ["workopia"],
  envKeys: ["WORKOPIA_TOKEN", "WORKOPIA_CITY", "WORKOPIA_CALLBACK_PORT"],
};

export function configured(): boolean {
  return workopiaConfigured();
}

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  return fetchWorkopiaJobs({
    keywords: Array.isArray(opts?.keywords)
      ? (opts.keywords as unknown[]).filter((k): k is string => typeof k === "string")
      : undefined,
    limit: typeof opts?.limit === "number" ? opts.limit : undefined,
    city: typeof opts?.city === "string" ? opts.city : undefined,
  });
}
