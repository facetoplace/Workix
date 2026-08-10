import type { Job } from "../types.js";
export type AtsProvider = "greenhouse" | "ashby" | "lever" | "smartrecruiters" | "workable";
export interface AtsCompany {
    ats: AtsProvider;
    slug: string;
    name?: string;
}
export declare function loadAtsCompanies(): AtsCompany[];
export declare function fetchAtsJobs(opts?: {
    companies?: AtsCompany[];
    /** Case-insensitive substring filter on the job title. */
    keywords?: string[];
    concurrency?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
