export interface FeedSearchArgs {
    q?: string;
    source?: string[];
    since?: string;
    limit?: number;
    offset?: number;
}
export declare function runFeedSearch(args: FeedSearchArgs): Promise<unknown>;
