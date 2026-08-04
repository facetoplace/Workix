/** Save where the search/outreach session stopped. */
export declare function runCheckpointSet(args: {
    summary: string;
    next?: string;
    surfaces?: string[];
    batch?: string;
    blocked?: string[];
    note?: string;
    at?: string;
    id?: string;
}): Promise<unknown>;
/** Resume: latest checkpoint (+ optional history). */
export declare function runCheckpointGet(args: {
    limit?: number;
}): Promise<unknown>;
