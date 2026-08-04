import type { Job } from "../types.js";
export declare function fetchFourDayWeekJobs(opts?: {
    pages?: number;
    remoteOnly?: boolean;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
