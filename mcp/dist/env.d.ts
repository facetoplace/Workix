/** Load mcp/.env then repo root .env (PROXY_1, KWORK_*, etc). */
export declare function loadEnv(): void;
/**
 * PROXY_1 → KWORK_PROXY → WORKIX_HTTP_PROXY
 * Поддерживаются socks5://… и http://… (HTTP CONNECT proxy).
 */
export declare function getProxyUrl(): string | undefined;
