import type { Job, JobKind } from "./types.js";
export interface KeywordMatch {
    score: number;
    hits: string[];
    strongHit: boolean;
}
/**
 * Score a card. A title hit counts triple — the title is what the poster is
 * actually hiring for, the body is context.
 */
export declare function scoreKeywords(job: Job, keywords?: string[], strong?: string[]): KeywordMatch;
/**
 * A card passes when it names a strong domain term, or clears the score
 * threshold on weaker ones. With `strong` configured, weak-only cards need at
 * least two distinct hits — that is what drops "мобильному дому".
 */
export declare function matchesKeywords(job: Job, keywords?: string[], opts?: {
    strong?: string[];
    minScore?: number;
}): boolean;
export declare function hitsMinus(job: Job, minus?: string[]): boolean;
export declare function whyMatch(job: Job, keywords?: string[], strong?: string[]): string;
export declare function filterJobs(jobs: Job[], opts: {
    hours?: number;
    keywords?: string[];
    minus?: string[];
    platforms?: string[];
    since?: string;
    min_budget?: number;
    kinds?: JobKind[];
    /** Domain terms that carry a card on their own (see matchesKeywords). */
    strong?: string[];
    minScore?: number;
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
