export declare function runTgStatus(): Promise<unknown>;
export declare function runTgAuth(args: {
    phone?: string;
    code?: string;
    password?: string;
}): Promise<unknown>;
/**
 * Telegram's message search is a substring match — it has no boolean grammar,
 * so `"flutter OR android OR ios"` is looked up as that literal string and
 * answers 0 for every chat. The rest of the project speaks OR (UPWORK_SEARCH,
 * presets → digest), so an agent naturally sends the same syntax here and reads
 * the empty answer as "Telegram is quiet today" — a silent false negative.
 *
 * Split it instead: each term is its own search, results merge and dedupe by
 * message id. Commas are treated the same way, being the other list syntax
 * people type.
 */
export declare function parseTgQueryTerms(query: string): string[];
export declare function runTgSearch(args: {
    query?: string;
    chats?: string[];
    limit?: number;
    save?: boolean;
    max_chats?: number;
    since?: string;
}): Promise<unknown>;
/**
 * Send ONE Telegram message from the logged-in account (face2place / Alice).
 * Dry-run by default: without confirm:true it returns what would be sent and
 * sends nothing. Real sends are logged to outreach. One message per call —
 * no mass sending; cold outreach is the caller's responsibility.
 */
export declare function runTgSend(args: {
    to?: string;
    text?: string;
    confirm?: boolean;
    note?: string;
    job_id?: string;
}): Promise<unknown>;
/**
 * Pre-flight estimate for a Telegram scan — how long it will take, WITHOUT
 * running it, from the moving average of recent scans. Lets the agent tell the
 * user the wait up front (e.g. "≈ 6 мин, 51 канал × 5 слов").
 */
export declare function runTgScanEta(args: {
    query?: string;
    chats?: string[];
    max_chats?: number;
}): Promise<unknown>;
