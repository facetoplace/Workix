export interface FetchResult {
    ok: boolean;
    status: number;
    text: string;
    ms: number;
    viaProxy: boolean;
    error?: string;
}
export declare function fetchText(url: string, opts?: {
    headers?: Record<string, string>;
    proxy?: string | false;
    timeoutMs?: number;
    retries?: number;
    maxProxies?: number;
    /** When false, never hit origin without PROXY_1 (RU boards / DDoS-Guard). Default true. */
    directFallback?: boolean;
    /** Persistent cookie jar name (see cookies.ts), e.g. "hh". Sends and refreshes it. */
    cookieJar?: string;
}): Promise<FetchResult>;
export declare function fetchJson<T = unknown>(url: string, opts?: {
    headers?: Record<string, string>;
    proxy?: string | false;
    cookieJar?: string;
}): Promise<{
    data?: T;
    error?: string;
    status: number;
    ms: number;
}>;
