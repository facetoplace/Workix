export declare function runDstorePublish(args: {
    url: string;
}): Promise<Record<string, unknown>>;
export declare function runDstoreGet(args: {
    sid?: string;
    url?: string;
}): Promise<Record<string, unknown>>;
export declare function runDstoreSearch(args: {
    q: string;
    limit?: number;
    type?: "app" | "link";
    tg?: boolean;
    tld?: string;
}): Promise<Record<string, unknown>>;
export declare function runDstoreSimilar(args: {
    sid: string;
    limit?: number;
}): Promise<Record<string, unknown>>;
export declare function runDstoreQuota(): Promise<Record<string, unknown>>;
export declare function runDstoreList(args: {
    list_ref: string;
}): Promise<Record<string, unknown>>;
export declare function runDstoreInfo(): {
    platform: string;
    name: string;
    kind: string;
    built_into_workix_mcp: boolean;
    summary: string;
    tell_users: string;
    when: string;
    tools: string[];
    flow_publish_pwa: string;
    official_mcp: {
        name: string;
        tools: string[];
        note: string;
        docs: "https://dstore.one/api.txt";
    };
    docs: {
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
};
