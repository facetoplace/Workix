import type { Job } from "./types.js";
export type Liveness = "alive" | "gone" | "unknown";
export interface LivenessResult {
    url: string;
    state: Liveness;
    reason?: string;
}
export declare function checkLink(url: string): Promise<LivenessResult>;
/** Check a batch with bounded concurrency; unknown is never treated as dead. */
export declare function checkJobsAlive(jobs: Job[], opts?: {
    concurrency?: number;
    limit?: number;
}): Promise<Map<string, LivenessResult>>;
