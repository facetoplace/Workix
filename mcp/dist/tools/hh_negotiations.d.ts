export declare function runHhNegotiations(args: {
    limit?: number;
    /** Only topics with unread employer messages or a pending question. */
    only_new?: boolean;
    /** Filter: "invitation" | "rejected" | "waiting" | "all" (default). */
    filter?: string;
    /** Pages of the negotiations list to walk. Default 2 (~40 topics). */
    pages?: number;
}): Promise<unknown>;
