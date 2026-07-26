import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchRemoteOkJobs } from "../adapters/remoteok.js";

export const meta: AdapterMeta = {
  id: "remoteok",
  version: "1.0.0",
  platforms: ["remoteok"],
};

export async function fetchJobs(_ctx: AdapterContext) {
  return fetchRemoteOkJobs();
}
