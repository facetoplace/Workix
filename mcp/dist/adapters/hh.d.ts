import type { Job } from "../types.js";
/** Fetch an hh.ru page with the saved session and return its SSR state. */
export declare function fetchHhState(url: string): Promise<{
    state?: Record<string, unknown>;
    status: number;
    error?: string;
    via?: string;
}>;
export declare function verifySession(): Promise<{
    authorized: boolean;
    userType?: string;
    status: number;
    jar: boolean;
    hint?: string;
}>;
export declare function fetchHhJobs(opts?: {
    text?: string;
    pages?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
