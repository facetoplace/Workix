import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import {
  fetchJobsPipeJobs,
  jobspipeConfigured,
  jobspipeUsage,
} from "../adapters/jobspipe.js";

export const meta: AdapterMeta = {
  id: "jobspipe",
  version: "1.1.0",
  platforms: ["jobspipe"],
  envKeys: [
    "JOBSPIPE_API_KEY",
    "JOBS_PIPE_KEY",
    "JOBSPIPE_TITLES",
    "JOBSPIPE_EXCLUDE_TITLES",
    "JOBSPIPE_COMPANIES",
    "JOBSPIPE_SKILLS",
    "JOBSPIPE_LOCATIONS",
    "JOBSPIPE_COUNTRIES",
    "JOBSPIPE_SOURCES",
    "JOBSPIPE_EXCLUDE_SOURCES",
    "JOBSPIPE_SENIORITY",
    "JOBSPIPE_EMPLOYMENT_TYPES",
    "JOBSPIPE_WORK_ARRANGEMENTS",
    "JOBSPIPE_REMOTE_ONLY",
    "JOBSPIPE_MAX_AGE_DAYS",
    "JOBSPIPE_LIMIT",
    "JOBSPIPE_MONTHLY_BUDGET",
  ],
};

export function configured(): boolean {
  return jobspipeConfigured();
}

export function usage(): unknown {
  return jobspipeUsage();
}

function strList(v: unknown): string[] | undefined {
  return Array.isArray(v) ? (v as string[]).filter(Boolean) : undefined;
}

export async function fetchJobs(
  _ctx: AdapterContext,
  opts?: Record<string, unknown>,
) {
  return fetchJobsPipeJobs({
    titles: strList(opts?.titles),
    excludeTitles: strList(opts?.excludeTitles),
    keywords: strList(opts?.keywords),
    companies: strList(opts?.companies),
    skills: strList(opts?.skills),
    locations: strList(opts?.locations),
    countries: strList(opts?.countries),
    sources: strList(opts?.sources),
    excludeSources: strList(opts?.excludeSources),
    seniority: strList(opts?.seniority),
    limit: typeof opts?.limit === "number" ? opts.limit : undefined,
    remoteOnly:
      typeof opts?.remoteOnly === "boolean" ? opts.remoteOnly : undefined,
  });
}
