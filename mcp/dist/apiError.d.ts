/** Structured MCP errors when upstream APIs return 429 / quota / cooldown. */
export type ApiErrorBody = {
    error?: string;
    message?: string;
    retryAfterSec?: number;
    retry_after?: number | string;
    limits?: {
        cooldownSec?: number;
        dailyMax?: number;
    };
};
export declare function parseRetryAfterHeader(value: string | null | undefined): number | undefined;
export declare function extractRetryAfterSec(body: unknown, headerRetryAfter?: string | null): number | undefined;
export declare function isRateLimitStatus(status: number): boolean;
export declare function isRateLimitError(status: number, code?: string): boolean;
export declare function formatRetryDuration(sec: number): string;
export declare function enrichApiError(args: {
    status: number;
    data?: unknown;
    retryAfterHeader?: string | null;
    service?: string;
    fallbackError?: string;
}): Record<string, unknown>;
