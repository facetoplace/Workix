import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import {
  fetchFreelancerJobs,
  freelancerConfigured,
  freelancerPlaceBid,
  freelancerProjectId,
} from "../adapters/freelancer.js";
import type { Job } from "../types.js";

export const meta: AdapterMeta = {
  id: "freelancer",
  version: "1.0.0",
  platforms: ["freelancer_com"],
  envKeys: ["FREELANCER_TOKEN", "FREELANCER_ACCESS_TOKEN"],
};

export function configured(): boolean {
  return freelancerConfigured();
}

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: { query?: string; limit?: number },
) {
  return fetchFreelancerJobs(opts);
}

export async function placeBid(
  _ctx: AdapterContext,
  opts: { projectId: number; amount: number; period: number; description: string },
) {
  return freelancerPlaceBid(opts);
}

export function projectId(job: Job) {
  return freelancerProjectId(job);
}
