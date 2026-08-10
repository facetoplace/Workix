import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchDiceJobs } from "../adapters/dice.js";

export const meta: AdapterMeta = {
  id: "dice",
  version: "1.0.0",
  platforms: ["dice"],
  envKeys: ["DICE_KEYWORD", "DICE_REMOTE_ONLY", "DICE_SPONSOR_ONLY"],
};

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  return fetchDiceJobs({
    keywords: Array.isArray(opts?.keywords)
      ? (opts.keywords as unknown[]).filter((k): k is string => typeof k === "string")
      : undefined,
    limit: typeof opts?.limit === "number" ? opts.limit : undefined,
    hours: typeof opts?.hours === "number" ? opts.hours : undefined,
    location: typeof opts?.location === "string" ? opts.location : undefined,
    willingToSponsor:
      typeof opts?.willing_to_sponsor === "boolean"
        ? opts.willing_to_sponsor
        : undefined,
  });
}
