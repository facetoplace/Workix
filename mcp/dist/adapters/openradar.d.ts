import type { Job } from "../types.js";
export declare const OPENRADAR_API_URL = "https://openradar.fun/api/leads";
export interface OpenRadarLead {
    id?: unknown;
    type?: unknown;
    title?: unknown;
    text?: unknown;
    url?: unknown;
    canonicalUrl?: unknown;
    author?: unknown;
    city?: unknown;
    budget?: unknown;
    currency?: unknown;
    paymentPeriod?: unknown;
    rawSalary?: unknown;
    normalizedUsdMin?: unknown;
    normalizedUsdMax?: unknown;
    category?: unknown;
    skills?: unknown;
    isRemote?: unknown;
    workplaceType?: unknown;
    direction?: unknown;
    publishedAt?: unknown;
    createdAt?: unknown;
    score?: unknown;
    verdict?: unknown;
    gates?: unknown;
    checks?: unknown;
    sourceRef?: unknown;
    contacts?: unknown;
    [key: string]: unknown;
}
export interface OpenRadarQuery {
    keywords?: string[];
    type?: "job" | "gig";
    skill?: string;
    budget?: number;
    language?: "ru" | "en";
    remote?: boolean;
    workplace?: "remote" | "hybrid" | "onsite";
    direction?: string;
    it?: boolean;
    sort?: "new" | "score" | "budget" | "relevance";
    limit?: number;
    page?: number;
}
export declare function normaliseOpenRadarPayload(payload: unknown): OpenRadarLead[];
declare function toJob(row: OpenRadarLead, fetchedAt: string): Job | undefined;
export declare function buildOpenRadarUrl(opts?: OpenRadarQuery): string;
export declare function fetchOpenRadarJobs(opts?: OpenRadarQuery): Promise<{
    jobs: Job[];
    error?: string;
}>;
export declare const _openRadarInternals: {
    toJob: typeof toJob;
};
export {};
