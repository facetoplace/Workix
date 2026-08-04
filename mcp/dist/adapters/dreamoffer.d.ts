import type { Job } from "../types.js";
/**
 * Dream Offer (find.dreamoffer.app) — IT/digital job aggregator.
 * Search: public GET /initial-dataset (+ optional vacancy.html SSR scan).
 * Apply: no native bid API — open source_link (TG / LinkedIn / ATS) via browser after user ok.
 */
export declare function fetchDreamOfferJobs(opts?: {
    limit?: number;
    profession?: string;
    workFormat?: string;
    keywords?: string[];
    lang?: string;
    /** Extra nn ids to hydrate via vacancy.html when page cache is thin (default 40). */
    scanExtra?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
