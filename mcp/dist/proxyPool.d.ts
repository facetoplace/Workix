/**
 * PROXY_1 may be:
 * - subscription URL (returns vless/ss/vmess/socks5 lines) — берём socks/http
 * - newline/comma list of proxies
 * - single socks5/http proxy
 */
export declare function getProxyPool(): Promise<string[]>;
export declare function nextProxy(): Promise<string | undefined>;
export declare function invalidateProxyCache(): void;
export declare function proxyPoolInfo(): Promise<{
    count: number;
    protocols: string[];
    source: string;
}>;
