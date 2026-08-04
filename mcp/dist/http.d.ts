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
}): Promise<FetchResult>;
export declare function fetchJson<T = unknown>(url: string, opts?: {
    headers?: Record<string, string>;
    proxy?: string | false;
}): Promise<{
    data?: T;
    error?: string;
    status: number;
    ms: number;
}>;
