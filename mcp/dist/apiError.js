/** Structured MCP errors when upstream APIs return 429 / quota / cooldown. */
export function parseRetryAfterHeader(value) {
    if (!value)
        return undefined;
    const trimmed = value.trim();
    const n = Number(trimmed);
    if (Number.isFinite(n) && n >= 0)
        return Math.ceil(n);
    const d = Date.parse(trimmed);
    if (Number.isFinite(d)) {
        const sec = Math.ceil((d - Date.now()) / 1000);
        return sec > 0 ? sec : undefined;
    }
    return undefined;
}
export function extractRetryAfterSec(body, headerRetryAfter) {
    const b = (body && typeof body === "object" ? body : {});
    const fromHeader = parseRetryAfterHeader(headerRetryAfter);
    const fromBody = typeof b.retryAfterSec === "number" && b.retryAfterSec > 0
        ? Math.ceil(b.retryAfterSec)
        : typeof b.retry_after === "number" && b.retry_after > 0
            ? Math.ceil(b.retry_after)
            : typeof b.retry_after === "string"
                ? parseRetryAfterHeader(b.retry_after)
                : undefined;
    return fromHeader ?? fromBody;
}
const RATE_LIMIT_CODES = new Set([
    "cooldown",
    "daily_limit",
    "rate_limit",
    "too_many_requests",
    "quota_exceeded",
]);
export function isRateLimitStatus(status) {
    return status === 429 || status === 503;
}
export function isRateLimitError(status, code) {
    if (isRateLimitStatus(status))
        return true;
    if (code && RATE_LIMIT_CODES.has(code.toLowerCase()))
        return true;
    return false;
}
export function formatRetryDuration(sec) {
    if (sec < 60)
        return `${sec}s`;
    if (sec < 3600)
        return `~${Math.ceil(sec / 60)} min`;
    if (sec < 86400)
        return `~${Math.ceil(sec / 3600)} h`;
    return `~${Math.ceil(sec / 86400)} d`;
}
function rateLimitMessage(code, retryAfterSec) {
    const wait = retryAfterSec
        ? ` Retry after ${formatRetryDuration(retryAfterSec)} (${retryAfterSec}s).`
        : "";
    switch (code) {
        case "cooldown":
            return `Rate limit: too soon since the last request.${wait}`;
        case "daily_limit":
            return `Rate limit: daily quota exhausted.${wait}`;
        case "quota_exceeded":
            return `Rate limit: quota exceeded.${wait}`;
        default:
            return `Rate limit hit (${code || "429"}).${wait}`;
    }
}
export function enrichApiError(args) {
    const body = args.data;
    const code = body?.error ||
        (typeof body?.message === "string"
            ? body.message
            : undefined) ||
        args.fallbackError;
    const codeStr = typeof code === "string" ? code : undefined;
    const retryAfterSec = extractRetryAfterSec(body, args.retryAfterHeader);
    const rateLimited = isRateLimitError(args.status, codeStr);
    const limits = body?.limits;
    const base = {
        ok: false,
        status: args.status,
        error: codeStr || args.fallbackError || `HTTP ${args.status}`,
        data: body,
    };
    if (!rateLimited)
        return base;
    const message = rateLimitMessage(codeStr, retryAfterSec);
    return {
        ...base,
        rateLimited: true,
        message,
        ...(retryAfterSec != null ? { retryAfterSec } : {}),
        ...(limits ? { limits } : {}),
        hint: [
            "Do not retry immediately — wait until retryAfterSec elapses.",
            retryAfterSec != null
                ? `Suggested: pause ${formatRetryDuration(retryAfterSec)}, then retry the same MCP tool once.`
                : "Check limits in the response or quota tools (workix_dstore_quota, hub docs).",
            args.service ? `Service: ${args.service}.` : null,
        ]
            .filter(Boolean)
            .join(" "),
    };
}
