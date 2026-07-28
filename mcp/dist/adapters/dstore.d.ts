export declare const DSTORE_DOCS: {
    readonly api: "https://dstore.one/api.txt";
    readonly llms: "https://dstore.one/llms.txt";
    readonly llm_alias: "https://dstore.one/llm.txt";
    readonly agent: "https://dstore.one/agent";
    readonly storefront: "https://dstore.one";
    readonly apiBase: "https://db.dstore.one";
    readonly search: "https://db.dstore.one/api/search";
    readonly similar: "https://db.dstore.one/api/similar";
    readonly quota: "https://db.dstore.one/api/agent/quota";
    readonly mcp: "dstore-mcp (stdio; tools search_catalog / get_app / get_similar / add_url / get_list / quota_status)";
};
/** Catalog search (semantic when embeddings exist). */
export declare function dstoreSearch(args: {
    q: string;
    limit?: number;
    type?: "app" | "link";
    tg?: boolean;
    tld?: string;
}): Promise<Record<string, unknown>>;
/** Stored-only similar apps (may be empty if not computed yet). */
export declare function dstoreSimilar(args: {
    sid: string | number;
    limit?: number;
}): Promise<Record<string, unknown>>;
export declare function dstoreQuota(): Promise<Record<string, unknown>>;
export declare function dstoreGetList(args: {
    list_ref: string;
}): Promise<Record<string, unknown>>;
/** Submit product URL into dStore catalog (rate-limited ~20/IP/hour). */
export declare function dstorePublish(args: {
    url: string;
}): Promise<Record<string, unknown>>;
/** Read dStore card JSON by sid (or full https://dstore.one/{sid} URL). */
export declare function dstoreGetCard(args: {
    sid?: string | number;
    url?: string;
}): Promise<Record<string, unknown>>;
