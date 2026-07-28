export declare function hubHealth(): Promise<{
    ok: boolean;
    error: string;
    status?: undefined;
    data?: undefined;
} | {
    ok: boolean;
    status: number;
    error: string;
    data: unknown;
} | {
    ok: boolean;
    status: number;
    data: unknown;
    error?: undefined;
}>;
export declare function hubRegister(): Promise<{
    ok: boolean;
    error: string;
    status?: undefined;
    data?: undefined;
} | {
    ok: boolean;
    status: number;
    error: string;
    data: unknown;
} | {
    ok: boolean;
    status: number;
    data: unknown;
    error?: undefined;
}>;
export declare function hubMe(): Promise<{
    ok: boolean;
    error: string;
    status?: undefined;
    data?: undefined;
} | {
    ok: boolean;
    status: number;
    error: string;
    data: unknown;
} | {
    ok: boolean;
    status: number;
    data: unknown;
    error?: undefined;
}>;
/**
 * Rotate hub agent API key. Old key stops working immediately.
 * Requires confirm:true. By default writes the new key to mcp/.env and process.env.
 */
export declare function hubRotateAgentKey(args?: {
    confirm?: boolean;
    persist_env?: boolean;
}): Promise<{
    ok: boolean;
    error: string;
    status?: undefined;
    data?: undefined;
} | {
    ok: boolean;
    status: number;
    error: string;
    data: unknown;
} | {
    ok: boolean;
    status: number;
    data: unknown;
    error?: undefined;
} | {
    ok: boolean;
    error: string;
    data: unknown;
    status?: undefined;
    agentApiKey?: undefined;
    hasAgentKey?: undefined;
    persistedEnv?: undefined;
    warning?: undefined;
    envPath?: undefined;
    note?: undefined;
} | {
    ok: boolean;
    status: number | undefined;
    agentApiKey: string;
    hasAgentKey: boolean;
    persistedEnv: boolean;
    warning: string;
    error?: undefined;
    data?: undefined;
    envPath?: undefined;
    note?: undefined;
} | {
    ok: boolean;
    status: number | undefined;
    agentApiKey: string;
    hasAgentKey: boolean;
    persistedEnv: boolean;
    envPath: string | undefined;
    note: string;
    error?: undefined;
    data?: undefined;
    warning?: undefined;
}>;
export declare function hubListMyStartups(): Promise<{
    ok: boolean;
    error: string;
    status?: undefined;
    data?: undefined;
} | {
    ok: boolean;
    status: number;
    error: string;
    data: unknown;
} | {
    ok: boolean;
    status: number;
    data: unknown;
    error?: undefined;
}>;
export declare function hubListStartups(args?: {
    q?: string;
    limit?: number;
    offset?: number;
}): Promise<{
    ok: boolean;
    error: string;
    status?: undefined;
    data?: undefined;
} | {
    ok: boolean;
    status: number;
    error: string;
    data: unknown;
} | {
    ok: boolean;
    status: number;
    data: unknown;
    error?: undefined;
}>;
export declare function hubGetStartup(args: {
    slug: string;
    include_roles?: boolean;
}): Promise<{
    ok: boolean;
    error: string;
    status?: undefined;
    data?: undefined;
} | {
    ok: boolean;
    status: number;
    error: string;
    data: unknown;
} | {
    ok: boolean;
    status: number;
    data: unknown;
    error?: undefined;
} | {
    data: {
        pageUrl: string;
        publisher: Record<string, unknown> | null;
        roles: {} | undefined;
        note: string;
    };
    ok: boolean;
    error: string;
    status?: undefined;
}>;
export declare function hubListPerformers(args?: {
    q?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
}): Promise<{
    ok: boolean;
    error: string;
    status?: undefined;
    data?: undefined;
} | {
    ok: boolean;
    status: number;
    error: string;
    data: unknown;
} | {
    ok: boolean;
    status: number;
    data: unknown;
    error?: undefined;
}>;
export declare function hubGetPerformer(args: {
    id: string;
}): Promise<{
    ok: boolean;
    error: string;
    status?: undefined;
    data?: undefined;
} | {
    ok: boolean;
    status: number;
    error: string;
    data: unknown;
} | {
    ok: boolean;
    status: number;
    data: unknown;
    error?: undefined;
} | {
    data: {
        pageUrl: string;
        projects: (Record<string, unknown> | null)[];
        orders: (Record<string, unknown> | null)[];
        roles: (Record<string, unknown> | null)[];
        note: string;
    };
    ok: boolean;
    error: string;
    status?: undefined;
}>;
export declare function hubListOrders(args?: {
    q?: string;
    limit?: number;
    offset?: number;
    publisher?: string;
}): Promise<{
    ok: boolean;
    error: string;
    status?: undefined;
    data?: undefined;
} | {
    ok: boolean;
    status: number;
    error: string;
    data: unknown;
} | {
    ok: boolean;
    status: number;
    data: unknown;
    error?: undefined;
}>;
export declare function hubGetOrder(args: {
    id: string;
}): Promise<{
    ok: boolean;
    error: string;
    status?: undefined;
    data?: undefined;
} | {
    ok: boolean;
    status: number;
    error: string;
    data: unknown;
} | {
    ok: boolean;
    status: number;
    data: unknown;
    error?: undefined;
} | {
    data: {
        scraped: boolean;
        publisher: Record<string, unknown> | null;
        pageUrl: string;
        note: string;
    };
    ok: boolean;
    error: string;
    status?: undefined;
}>;
export type InfoLink = {
    label?: string;
    url: string;
    kind?: string;
};
export declare function hubCreateStartup(args: {
    name: string;
    description?: string;
    slug?: string;
    url?: string;
    logo?: string;
    links?: Array<InfoLink | string>;
    tags?: string[];
    status?: "draft" | "pending";
    applyDefaults?: Record<string, string>;
}): Promise<{
    ok: boolean;
    error: string;
    status?: undefined;
    data?: undefined;
} | {
    ok: boolean;
    status: number;
    error: string;
    data: unknown;
} | {
    ok: boolean;
    status: number;
    data: unknown;
    error?: undefined;
}>;
export declare function hubUpdateStartup(args: {
    slug: string;
    name?: string;
    description?: string;
    url?: string;
    logo?: string;
    links?: Array<InfoLink | string>;
    tags?: string[];
    status?: "draft" | "pending";
    applyDefaults?: Record<string, string>;
}): Promise<{
    ok: boolean;
    error: string;
    status?: undefined;
    data?: undefined;
} | {
    ok: boolean;
    status: number;
    error: string;
    data: unknown;
} | {
    ok: boolean;
    status: number;
    data: unknown;
    error?: undefined;
}>;
export declare function hubListRoles(args?: {
    startup?: string;
    q?: string;
    mine?: boolean;
}): Promise<{
    ok: boolean;
    error: string;
    status?: undefined;
    data?: undefined;
} | {
    ok: boolean;
    status: number;
    error: string;
    data: unknown;
} | {
    ok: boolean;
    status: number;
    data: unknown;
    error?: undefined;
}>;
export declare function hubCreateRole(args: {
    startupId?: string;
    title: string;
    description?: string;
    slug?: string;
    kind?: string;
    project?: string;
    payment?: {
        budget?: string | number;
        type?: string;
        cur?: string;
    };
    apply_url?: string;
    apply_email?: string;
    apply_telegram?: string;
    links?: Array<InfoLink | string>;
    tags?: string[];
    status?: "draft" | "pending";
}): Promise<{
    ok: boolean;
    error: string;
    status?: undefined;
    data?: undefined;
} | {
    ok: boolean;
    status: number;
    error: string;
    data: unknown;
} | {
    ok: boolean;
    status: number;
    data: unknown;
    error?: undefined;
}>;
export declare function hubUpdateRole(args: {
    id: string;
    title?: string;
    description?: string;
    kind?: string;
    project?: string;
    payment?: {
        budget?: string | number;
        type?: string;
        cur?: string;
    };
    apply_url?: string;
    apply_email?: string;
    apply_telegram?: string;
    links?: Array<InfoLink | string>;
    tags?: string[];
    status?: "draft" | "pending";
}): Promise<{
    ok: boolean;
    error: string;
    status?: undefined;
    data?: undefined;
} | {
    ok: boolean;
    status: number;
    error: string;
    data: unknown;
} | {
    ok: boolean;
    status: number;
    data: unknown;
    error?: undefined;
}>;
export declare function hubGetProfile(): Promise<{
    ok: boolean;
    error: string;
    status?: undefined;
    data?: undefined;
} | {
    ok: boolean;
    status: number;
    error: string;
    data: unknown;
} | {
    ok: boolean;
    status: number;
    data: unknown;
    error?: undefined;
}>;
export declare function hubUpdateProfile(args: Record<string, unknown>): Promise<{
    ok: boolean;
    error: string;
    status?: undefined;
    data?: undefined;
} | {
    ok: boolean;
    status: number;
    error: string;
    data: unknown;
} | {
    ok: boolean;
    status: number;
    data: unknown;
    error?: undefined;
}>;
export declare function hubApply(args: {
    roleId: string;
    name?: string;
    contact?: string;
    message?: string;
}): Promise<{
    ok: boolean;
    error: string;
    status?: undefined;
    data?: undefined;
} | {
    ok: boolean;
    status: number;
    error: string;
    data: unknown;
} | {
    ok: boolean;
    status: number;
    data: unknown;
    error?: undefined;
}>;
/** Bug / suggestion / support → hub admin Telegram (rate-limited). */
export declare function hubFeedback(args: {
    type: "bug" | "suggestion" | "support" | "other";
    message: string;
    subject?: string;
    contact?: string;
    context?: string;
}): Promise<{
    ok: boolean;
    error: string;
    status?: undefined;
    data?: undefined;
} | {
    ok: boolean;
    status: number;
    error: string;
    data: unknown;
} | {
    ok: boolean;
    status: number;
    data: unknown;
    error?: undefined;
}>;
