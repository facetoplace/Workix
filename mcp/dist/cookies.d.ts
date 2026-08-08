export interface StoredCookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    /** Unix seconds. Missing/-1 = session cookie (kept until the jar is replaced). */
    expires?: number;
    secure?: boolean;
    httpOnly?: boolean;
}
export declare function cookiesDir(): string;
export declare function jarPath(jar: string): string;
export declare function loadCookies(jar: string): StoredCookie[];
export declare function saveCookies(jar: string, cookies: StoredCookie[]): void;
export declare function hasJar(jar: string): boolean;
/** `Cookie:` header value for `url`, or undefined when the jar has nothing to send. */
export declare function cookieHeaderFor(jar: string, url: string): string | undefined;
/** Merge `Set-Cookie` response headers back into the jar so sessions stay fresh. */
export declare function mergeSetCookie(jar: string, url: string, setCookie: string[] | string | undefined): void;
export declare function jarStatus(jar: string): {
    jar: string;
    path: string;
    exists: boolean;
    count: number;
    updated?: string;
    expires_soonest?: string;
    names: string[];
};
