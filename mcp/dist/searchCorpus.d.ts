/**
 * Local, network-free search over the job store (any platform). This is the
 * "phase 2" of collect→search: collectors upsert raw postings into the DB, then
 * this ranks/filters what's already there — keyword token match, résumé drop,
 * "already applied" cross-check, and cross-post collapse. Shared by the Telegram
 * dump path and the cross-source DB search so the matching logic lives once.
 */
import type { Job } from "./types.js";
export interface OutreachLike {
    url?: string;
    contact?: string;
    project?: string;
}
/** Generic role/tech words that are NOT a company/product name. */
export declare const APPLIED_STOP: Set<string>;
export declare const applyNorm: (s: string) => string;
/** Candidate self-adverts (résumés / "for hire"), not vacancies. */
export declare const RESUME_RE: RegExp;
/**
 * Company/advertiser a posting is attributed to, from the title ("Senior X @
 * Company" / "Company: …"). Used to cap any single advertiser (talent-pool
 * marketplaces like Lemon.io cross-post dozens of near-identical ads).
 */
export declare function advertiserKey(title: string): string | null;
export interface AppliedIndex {
    urls: Set<string>;
    keys: string[];
}
/** Urls (always) + name anchors that are RARE in the corpus (⇒ a real name, not
 * a generic role word). @handles are always trusted. */
export declare function buildAppliedIndex(outreach: OutreachLike[], corpus: Array<{
    title: string;
    description?: string;
}>): AppliedIndex;
export declare function matchApplied(job: {
    link: string;
    title: string;
    description?: string;
}, idx: AppliedIndex): "url" | "name" | null;
export interface CorpusSearchOpts {
    query?: string;
    limit?: number;
    hide_applied?: boolean;
    /** Only keep résumé-looking posts out (default true). */
    drop_resumes?: boolean;
    /** Max postings per advertiser in the visible top (default 3; 0 = no cap). */
    max_per_advertiser?: number;
}
export interface CorpusResult {
    score: number;
    age_days: number;
    matched_terms: string[];
    applied: boolean;
    applied_via?: "url" | "name";
    cross_posts?: number;
    also_in?: string[];
    platform: string;
    title: string;
    link: string;
    date: string;
    snippet: string;
}
/** Split "a OR b, c" into terms. */
export declare function parseTerms(query: string): string[];
/**
 * Rank a corpus locally. Word terms match on token boundary (so "ton" ≠
 * "button"); multi-word / special terms ("high load", "node.js") match as
 * substrings. Cross-posts (same title+body across channels) collapse to the
 * best-ranked copy.
 */
export declare function searchCorpus(corpus: Job[], outreach: OutreachLike[], opts: CorpusSearchOpts): {
    total: number;
    duplicates_collapsed: number;
    applied_count: number;
    open_count: number;
    results: CorpusResult[];
};
