export declare function runTrackApply(args: {
    job_id?: string;
    url?: string;
    /** Hub listing ids — use when applying to something already on workix.co. */
    order_id?: string;
    role_id?: string;
    status?: string;
    /** tg | hh | email | board | browser | api — how it was sent. */
    channel?: string;
    /** agent = the agent sent it itself; user = the human applied by hand. */
    via?: "agent" | "user";
    /** The proposal / cover letter that was actually sent. */
    text?: string;
    note?: string;
    applied_at?: string;
    /** Only needed when the job is not in the local store. */
    platform?: string;
    title?: string;
    description?: string;
    budget?: string;
}): Promise<unknown>;
export declare function runListApplies(args?: {
    status?: string;
    q?: string;
    url?: string;
    since?: string;
    limit?: number;
    with_text?: boolean;
}): Promise<unknown>;
export declare function runUpdateApply(args: {
    id: string;
    status?: string;
    text?: string;
    text_source?: "agent" | "user";
    note?: string;
}): Promise<unknown>;
/**
 * Remove an application record — a mistracked apply, or a test row.
 * Deletes the hub row and the local mirror; the job stays in the catalog, since
 * that listing is a contribution to the board, not part of this private log.
 */
export declare function runDeleteApply(args: {
    id: string;
    confirm?: boolean;
}): Promise<unknown>;
/**
 * Pull the hub history into the local store, so a fresh machine (or a wiped
 * mcp/data) still knows what was already applied to — digest `only_new` and the
 * contacted filter read the local outreach table.
 */
export declare function runSyncApplies(args?: {
    since?: string;
    limit?: number;
}): Promise<unknown>;
