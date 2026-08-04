export declare function runGetJob(args: {
    id?: string;
    url?: string;
    refresh?: boolean;
    /** Capture watch/browser lead into store when not found via digest. */
    platform?: string;
    title?: string;
    description?: string;
    budget?: string;
}): Promise<unknown>;
