/**
 * JobsPipe is metered — one credit per job returned — so these tools exist to
 * make the meter visible and to let a search be aimed precisely instead of
 * pulled blind through the digest.
 */
export declare function runJobspipeUsage(args?: {
    reset?: boolean;
}): Promise<unknown>;
export declare function runJobspipeSearch(args: {
    titles?: string[];
    exclude_titles?: string[];
    keywords?: string[];
    companies?: string[];
    skills?: string[];
    locations?: string[];
    countries?: string[];
    sources?: string[];
    exclude_sources?: string[];
    seniority?: string[];
    remote_only?: boolean;
    max_age_days?: number;
    limit?: number;
}): Promise<unknown>;
export declare function runCompanyTechStack(args: {
    domain: string;
    mode?: string;
}): Promise<unknown>;
