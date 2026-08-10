import type { Job } from "../types.js";
export declare function jobspipeKey(): string;
export declare function jobspipeConfigured(): boolean;
interface Ledger {
    month: string;
    jobs: number;
    calls: number;
    updatedAt: string;
}
export declare function readLedger(): Ledger;
export declare function monthlyBudget(): number;
export declare function jobspipeUsage(): {
    month: string;
    jobs: number;
    calls: number;
    budget: number;
    remaining: number;
    configured: boolean;
};
/** Wipe the local counter — for when the plan renews off-cycle. */
export declare function resetJobspipeUsage(): Ledger;
export interface JobsPipeFilters {
    titles?: string[];
    excludeTitles?: string[];
    keywords?: string[];
    companies?: string[];
    skills?: string[];
    locations?: string[];
    countries?: string[];
    sources?: string[];
    excludeSources?: string[];
    seniority?: string[];
    employmentTypes?: string[];
    remoteOnly?: boolean;
    workArrangements?: string[];
    maxAgeDays?: number;
    limit?: number;
    includeTotal?: boolean;
}
export declare function fetchJobsPipeJobs(filters?: JobsPipeFilters): Promise<{
    jobs: Job[];
    error?: string;
    totalCount?: number;
}>;
/**
 * `detect_company_tech_stack` has no REST route (probed 2026-08-09: /v1/stack*
 * → 404), so it is called over their MCP endpoint. Useful before writing a
 * proposal: naming the stack a company actually runs beats guessing from the
 * job ad.
 */
export declare function detectCompanyTechStack(args: {
    domain: string;
    mode?: string;
}): Promise<{
    ok: boolean;
    result?: unknown;
    error?: string;
}>;
export {};
