import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchReactJobs } from "../adapters/reactjobs.js";

export const meta: AdapterMeta = {
  id: "reactjobs",
  version: "1.0.0",
  platforms: ["reactjobs"],
};

export async function fetchJobs(_ctx: AdapterContext, opts?: Record<string, unknown>) {
  return fetchReactJobs(opts as { keywords?: string[] });
}
