import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchClawEarnJobs } from "../adapters/claw_earn.js";

export const meta: AdapterMeta = {
  id: "claw_earn",
  version: "1.0.0",
  platforms: ["claw_earn"],
};

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  return fetchClawEarnJobs({
    tab: typeof opts?.tab === "string" ? opts.tab : undefined,
    limit: typeof opts?.limit === "number" ? opts.limit : undefined,
  });
}
