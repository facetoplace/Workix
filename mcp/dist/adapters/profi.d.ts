import type { Job } from "../types.js";
/**
 * Profi.ru — RU services marketplace (private clients). The partner mTLS API is
 * out of scope, so orders are read from the logged-in cabinet through the
 * persistent `profi` browser profile (log in once via
 * scripts/board-open.mjs profi https://profi.ru/backoffice/ + board-save.mjs profi).
 * Read-only ingest; отклик остаётся ручным через сайт. Filters locally by keyword.
 *
 * PROFI_URL overrides the cabinet feed page (e.g. a saved filtered view).
 */
export declare function fetchProfiJobs(opts?: {
    keywords?: string[];
    limit?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
