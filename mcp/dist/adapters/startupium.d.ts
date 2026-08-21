import type { Job } from "../types.js";
export declare function fetchStartupiumLeads(opts?: {
    kind?: "projects" | "profiles" | "all";
    keywords?: string[];
    limit?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
