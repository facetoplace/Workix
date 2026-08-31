import type { Job } from "./types.js";
export declare function refreshJobs(opts?: {
    platforms?: string[];
    includeKwork?: boolean;
    include_jobs?: boolean;
    include_agent_gigs?: boolean;
    /** Pull RU browser-profile services (Profi.ru, Avito) into the run. */
    include_services?: boolean;
    include_freelancehunt?: boolean;
    include_upwork?: boolean;
    include_freelancer?: boolean;
    hh_text?: string;
    upwork_query?: string;
    freelancer_query?: string;
    /** Passed to adapters that support text filter (e.g. Dream Offer). */
    keywords?: string[];
    /** Skip the shared cache and re-read every source from the network. */
    force_refresh?: boolean;
    /** Don't fold Telegram in — collect sweeps TG separately (see workix_collect). */
    skip_telegram?: boolean;
}): Promise<{
    jobs: Job[];
    errors: string[];
    cached: string[];
    /** Per-location clones of one posting dropped before the store saw them. */
    duplicates_collapsed: number;
}>;
