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
    collab?: string[];
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
/**
 * "Delete" a company/startup card from the catalog. This is a SOFT close: the
 * listing is flipped to status "closed" (hidden from the public catalog) via the
 * owner-permitted PATCH. The row is kept — full hard delete (removing roles and
 * applications for good) is admin-only on the server (DELETE /startups/:slug).
 */
export declare function hubDeleteStartup(args: {
    slug: string;
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
export declare function hubBumpProfile(): Promise<Record<string, unknown>>;
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
/** Funnel used by the hub application tracker (lib/hub-applications.js). */
export type ApplicationStatus = "draft" | "sent" | "viewed" | "reply" | "interview" | "offer" | "hired" | "rejected" | "closed";
/**
 * Record "the user applied to this job" on the hub. A raw board job
 * (url + platform + title) is mirrored into the catalog first, so tracking an
 * apply also publishes the listing. Idempotent per listing.
 */
export declare function hubRecordApplication(args: {
    orderId?: string;
    roleId?: string;
    url?: string;
    platform?: string;
    externalId?: string;
    title?: string;
    description?: string;
    kind?: string;
    budget?: string;
    tags?: string[];
    originalPublishedAt?: string;
    status?: ApplicationStatus | string;
    channel?: string;
    via?: "agent" | "user" | "web";
    text?: string;
    textSource?: "agent" | "user";
    note?: string;
    appliedAt?: string;
}): Promise<Record<string, unknown>>;
/** The caller's own applications — cross-device history, with the sent texts. */
export declare function hubListApplications(args?: {
    status?: string;
    q?: string;
    url?: string;
    orderId?: string;
    roleId?: string;
    since?: string;
    limit?: number;
    offset?: number;
    with_text?: boolean;
}): Promise<Record<string, unknown>>;
/** Move an application along the funnel, or attach the text after the fact. */
export declare function hubUpdateApplication(args: {
    id: string;
    status?: ApplicationStatus | string;
    text?: string;
    textSource?: "agent" | "user";
    note?: string;
    channel?: string;
    appliedAt?: string;
}): Promise<Record<string, unknown>>;
/** Delete one of the caller's application rows. The catalog listing stays. */
export declare function hubDeleteApplication(args: {
    id: string;
}): Promise<Record<string, unknown>>;
/** Bug / suggestion / support → hub admin Telegram (rate-limited). */
export declare function hubFeedback(args: {
    type: "bug" | "suggestion" | "support" | "other";
    message: string;
    subject?: string;
    contact?: string;
    context?: string;
}): Promise<Record<string, unknown>>;
