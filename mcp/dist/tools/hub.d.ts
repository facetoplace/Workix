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
