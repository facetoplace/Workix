import type { AdapterContext, AdapterMeta } from "../adapterModule.js";
import type { Job } from "../types.js";
export declare const meta: AdapterMeta;
export declare function configured(): boolean;
export declare function fetchJobs(_ctx: AdapterContext, opts?: {
    query?: string;
    first?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
    totalCount?: number;
}>;
export declare function authUrl(state?: string): {
    url: string;
    redirect_uri: string;
    note: string;
};
export declare function exchangeCode(code: string): Promise<{
    ok: boolean;
    error?: string;
    expires_in?: number;
}>;
export declare function companySelector(): Promise<{
    ok: boolean;
    items?: Array<{
        title?: string;
        organizationId?: string;
    }>;
    error?: string;
}>;
export declare function createProposal(opts: {
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
export declare function jobReference(job: Job): string | undefined;
