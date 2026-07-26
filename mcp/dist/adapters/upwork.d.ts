import type { Job } from "../types.js";
export declare function upworkConfigured(): boolean;
export declare function upworkAuthUrl(state?: string): {
    url: string;
    redirect_uri: string;
    note: string;
};
export declare function upworkExchangeCode(code: string): Promise<{
    ok: boolean;
    error?: string;
    expires_in?: number;
}>;
export declare function fetchUpworkJobs(opts?: {
    query?: string;
    first?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
    totalCount?: number;
}>;
export declare function upworkCompanySelector(): Promise<{
    ok: boolean;
    items?: Array<{
        title?: string;
        organizationId?: string;
    }>;
    error?: string;
}>;
/** Best-effort createJobProposal; needs Submit Proposal permission + IDs in env. */
export declare function upworkCreateProposal(opts: {
    jobReference: string;
    coverLetter: string;
    chargedAmount: number;
    estimatedDuration?: number;
}): Promise<{
    ok: boolean;
    error?: string;
    raw?: unknown;
    browserHint?: string;
}>;
export declare function upworkJobReference(job: Job): string | undefined;
