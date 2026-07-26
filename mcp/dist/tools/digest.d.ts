export declare function runDigest(args: {
    hours?: number;
    keywords?: string[];
    minus?: string[];
    platforms?: string[];
    limit?: number;
    only_new?: boolean;
    preset?: string;
    include_jobs?: boolean;
    include_services?: boolean;
    use_profile_filters?: boolean;
}): Promise<unknown>;
