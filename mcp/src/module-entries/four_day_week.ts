import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchFourDayWeekJobs } from "../adapters/four_day_week.js";

export const meta: AdapterMeta = {
  id: "four_day_week",
  version: "1.0.0",
  platforms: ["four_day_week"],
};

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  return fetchFourDayWeekJobs({
    pages: typeof opts?.pages === "number" ? opts.pages : undefined,
    remoteOnly:
      typeof opts?.remoteOnly === "boolean" ? opts.remoteOnly : undefined,
  });
}
