import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchAijobsJobs } from "../adapters/aijobs.js";

export const meta: AdapterMeta = {
  id: "aijobs",
  version: "1.0.0",
  platforms: ["aijobs"],
};

export async function fetchJobs(_ctx: AdapterContext, opts?: Record<string, unknown>) {
  return fetchAijobsJobs(opts as { keywords?: string[] });
}
