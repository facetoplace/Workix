import type { Job } from "./types.js";
export declare function matchesKeywords(job: Job, keywords?: string[]): boolean;
export declare function hitsMinus(job: Job, minus?: string[]): boolean;
export declare function whyMatch(job: Job, keywords?: string[]): string;
export declare function filterJobs(jobs: Job[], opts: {
    hours?: number;
    keywords?: string[];
    minus?: string[];
    platforms?: string[];
    since?: string;
    min_budget?: number;
    kinds?: Array<"gig" | "job" | "service">;
}): Job[];
export declare function cardSummary(job: Job, keywords?: string[]): {
    id: string;
    platform: string;
    kind?: string;
    title: string;
    budget?: string;
    link: string;
    date: string;
    snippet: string;
    why_match: string;
};
export declare function digestText(cards: ReturnType<typeof cardSummary>[], meta: {
    hours: number;
    errors: string[];
    preset?: string;
}): string;
