import type { Job } from "../types.js";
/**
 * Avito Работа — RU vacancies. Avito's terms restrict automated collection, so
 * this adapter is double-gated: it runs solely when the caller names `avito` AND
 * sets AVITO_ENABLE=1, and it never applies — отклик/чат остаётся ручным. Reads
 * the vacancy feed from the logged-in `avito` browser profile, headful (Avito
 * challenges headless). Log in once via scripts/board-open.mjs avito
 * https://www.avito.ru/profile + board-save.mjs avito. Filters locally by keyword.
 *
 * AVITO_URL overrides the feed — point it at a saved vacancy search (region /
 * remote / query), e.g. https://www.avito.ru/all/vakansii?...
 */
export declare function fetchAvitoJobs(opts?: {
    keywords?: string[];
    limit?: number;
}): Promise<{
    jobs: Job[];
    error?: string;
}>;
