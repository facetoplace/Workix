import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchWeb3CareerJobs } from "../adapters/web3career.js";

export const meta: AdapterMeta = {
  id: "web3career",
  version: "1.0.0",
  platforms: ["web3career"],
};

export async function fetchJobs(_ctx: AdapterContext, opts?: Record<string, unknown>) {
  return fetchWeb3CareerJobs(opts as { keywords?: string[]; pages?: number });
}
