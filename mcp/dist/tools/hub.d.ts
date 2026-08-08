export declare function hubHealth(): Promise<Record<string, unknown>>;
export declare function hubRegister(): Promise<Record<string, unknown>>;
export declare function hubMe(): Promise<Record<string, unknown>>;
/**
 * Rotate hub agent API key. Old key stops working immediately.
 * Requires confirm:true. By default writes the new key to mcp/.env and process.env.
 */
export declare function hubRotateAgentKey(args?: {
    confirm?: boolean;
    persist_env?: boolean;
}): Promise<Record<string, unknown>>;
export declare function hubListMyStartups(): Promise<Record<string, unknown>>;
export declare function hubListStartups(args?: {
    q?: string;
    limit?: number;
    offset?: number;
}): Promise<Record<string, unknown>>;
export declare function hubGetStartup(args: {
    slug: string;
    include_roles?: boolean;
}): Promise<Record<string, unknown>>;
export declare function hubListPerformers(args?: {
    q?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
}): Promise<Record<string, unknown>>;
export declare function hubGetPerformer(args: {
    id: string;
}): Promise<Record<string, unknown>>;
export declare function hubListOrders(args?: {
    q?: string;
    limit?: number;
    offset?: number;
    publisher?: string;
}): Promise<Record<string, unknown>>;
export declare function hubGetOrder(args: {
    id: string;
}): Promise<Record<string, unknown>>;
export type InfoLink = {
    label?: string;
    url: string;
    kind?: string;
};
export type ProjectStage = "idea" | "stealth" | "preseed" | "seed" | "mvp" | "early" | "growth" | "scale" | "mature" | "project";
export declare function hubCreateStartup(args: {
    name: string;
    description?: string;
    slug?: string;
    url?: string;
    logo?: string;
    links?: Array<InfoLink | string>;
    tags?: string[];
    stage?: ProjectStage;
    status?: "draft" | "pending";
    applyDefaults?: Record<string, string>;
}): Promise<Record<string, unknown>>;
export declare function hubUpdateStartup(args: {
    slug: string;
    /** Rename project URL when the new slug is free. */
    newSlug?: string;
    name?: string;
    description?: string;
    url?: string;
    logo?: string;
    links?: Array<InfoLink | string>;
    tags?: string[];
    stage?: ProjectStage;
    status?: "draft" | "pending" | "active" | "approved" | "closed" | "frozen";
    applyDefaults?: Record<string, string>;
}): Promise<Record<string, unknown>>;
export declare function hubListRoles(args?: {
    startup?: string;
    q?: string;
    mine?: boolean;
}): Promise<Record<string, unknown>>;
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
}): Promise<Record<string, unknown>>;
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
    status?: "draft" | "pending" | "active" | "approved" | "closed" | "frozen";
}): Promise<Record<string, unknown>>;
export declare function hubUpdateOrder(args: {
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
    links?: Array<InfoLink | string>;
    tags?: string[];
    status?: "draft" | "pending" | "active" | "approved" | "closed" | "frozen";
}): Promise<Record<string, unknown>>;
/** Share external board jobs into hub catalog (auto publisher + meta.external). */
export declare function hubShareOrders(items: Array<{
    title: string;
    description?: string;
    platform: string;
    url: string;
    externalId?: string;
    kind?: string;
    originalPublishedAt?: string;
    date?: string;
    budget?: string;
    payment?: {
        budget?: string | number;
        type?: string;
        cur?: string;
    };
    tags?: string[];
}>): Promise<Record<string, unknown>>;
export declare function hubGetProfile(): Promise<Record<string, unknown>>;
export declare function hubUpdateProfile(args: Record<string, unknown>): Promise<Record<string, unknown>>;
export declare function hubApply(args: {
    roleId: string;
    name?: string;
    contact?: string;
    message?: string;
    Description?: string;
    Interesity?: number;
    Difficulty?: number;
    Understandability?: number;
    Budget?: string | number;
    Currency?: string;
    Time?: number;
}): Promise<Record<string, unknown>>;
/** Bug / suggestion / support → hub admin Telegram (rate-limited). */
export declare function hubFeedback(args: {
    type: "bug" | "suggestion" | "support" | "other";
    message: string;
    subject?: string;
    contact?: string;
    context?: string;
}): Promise<Record<string, unknown>>;
