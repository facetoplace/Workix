import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import {
  fetchUpworkJobs,
  upworkAuthUrl,
  upworkCompanySelector,
  upworkConfigured,
  upworkCreateProposal,
  upworkExchangeCode,
  upworkJobReference,
} from "../adapters/upwork.js";
import type { Job } from "../types.js";

export const meta: AdapterMeta = {
  id: "upwork",
  version: "1.0.0",
  platforms: ["upwork"],
  envKeys: [
    "UPWORK_CLIENT_ID",
    "UPWORK_CLIENT_SECRET",
    "UPWORK_REDIRECT_URI",
    "UPWORK_ACCESS_TOKEN",
    "UPWORK_REFRESH_TOKEN",
  ],
};

export function configured(): boolean {
  return upworkConfigured();
}

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: { query?: string; first?: number },
) {
  return fetchUpworkJobs(opts);
}

export function authUrl(state?: string) {
  return upworkAuthUrl(state);
}

export async function exchangeCode(code: string) {
  return upworkExchangeCode(code);
}

export async function companySelector() {
  return upworkCompanySelector();
}

export async function createProposal(opts: {
  jobReference: string;
  coverLetter: string;
  chargedAmount: number;
  estimatedDuration?: number;
}) {
  return upworkCreateProposal(opts);
}

export function jobReference(job: Job) {
  return upworkJobReference(job);
}
