import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import { fetchKworkJobs, kworkConfigured, kworkGetMe } from "../adapters/kwork.js";

export const meta: AdapterMeta = {
  id: "kwork",
  version: "1.0.0",
  platforms: ["kwork"],
  envKeys: ["KWORK_LOGIN", "KWORK_PASSWORD", "KWORK_PHONE4", "KWORK_PROXY"],
};

export function configured(): boolean {
  return kworkConfigured();
}

export async function fetchJobs(_ctx: AdapterContext) {
  return fetchKworkJobs();
}

export async function getMe() {
  return kworkGetMe();
}
