import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import {
  fetchFreelancehuntJobs,
  freelancehuntBid,
  freelancehuntConfigured,
} from "../adapters/freelancehunt.js";

export const meta: AdapterMeta = {
  id: "freelancehunt",
  version: "1.0.0",
  platforms: ["freelancehunt"],
  envKeys: ["FREELANCEHUNT_TOKEN"],
};

export function configured(): boolean {
  return freelancehuntConfigured();
}

export async function fetchJobs(_ctx: AdapterContext) {
  return fetchFreelancehuntJobs();
}

export async function bid(
  _ctx: AdapterContext,
  opts: { projectId: number; days: number; amount: number; currency: string; comment: string },
) {
  return freelancehuntBid(opts);
}
