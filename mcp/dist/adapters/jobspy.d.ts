import type { Job } from "../types.js";
export declare const JOBSPY_PLATFORMS: string[];
export declare function jobspyAvailable(env: NodeJS.ProcessEnv): Promise<boolean>;
/** Installed python-jobspy version, or null when the bridge is unavailable. */
export declare function jobspyStatus(env: NodeJS.ProcessEnv): Promise<{
    available: boolean;
    python?: string;
    version?: string;
    platforms: string[];
    hint?: string;
}>;
export declare function fetchJobSpyJobs(opts: {
    env: NodeJS.ProcessEnv;
    /** Our platform id, e.g. "indeed". */
    platform: string;
    what?: string;
    location?: string;
    hours?: number;
    limit?: number;
    /** Rotating proxies; every board here blocks aggressively. */
    proxies?: string[];
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
