import type { Job } from "../types.js";
/**
 * Gildia (gildia.global) — a networking platform where people post "leads":
 * client requests gathered from chats and groups (kind: lead, NOT a vacancy).
 *
 * How we read it
 * --------------
 * Gildia's feed lives behind an email/password login that the server protects
 * with an anti-bot challenge (POST /api/auth/login answers `captcha_failed` to
 * a plain HTTP client). So there is no headless HTTP login here — instead the
 * adapter reuses a browser profile you signed into ONCE, and pulls the feed from
 * inside that logged-in page:
 *
 *   1. reads the JWT the SPA keeps in localStorage (`accessToken`);
 *   2. calls the site's own JSON API from the page (same origin, Authorization
 *      header) — GET /api/leads;
 *   3. if the API call fails, falls back to reading the rendered lead cards
 *      straight from the DOM.
 *
 * Log in once (window opens, you type there — nothing goes through the agent):
 *   node scripts/board-open.mjs gildia https://gildia.global/ru/login
 *   node scripts/board-save.mjs gildia
 *
 * Read-only: отклик/чат с клиентом остаются ручными на сайте. Filtering by
 * keywords happens locally over a page we pull in full.
 *
 * GILDIA_URL overrides the feed page (e.g. a saved filtered view).
 */
interface RawLead {
    title: string;
    price: string;
    link: string;
    meta: string;
}
export declare function extractGildiaSnapshot(snapshot: string, origin?: string): Promise<{
    source: "dom";
    items: RawLead[];
}>;
export declare function fetchGildiaJobs(opts?: {
    keywords?: string[];
    limit?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
/** True when a Gildia browser profile exists — not proof of a live session. */
export declare function gildiaConfigured(): boolean;
export {};
