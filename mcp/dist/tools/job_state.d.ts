/**
 * One lookup that answers "what has already been done with this card" —
 * shown in a digest, mirrored to the hub, drafted, applied to — plus the next
 * step that follows from that state. Meant to be called before drafting or
 * submitting, so the agent never re-applies to something it already handled.
 *
 * The local store only knows about this machine, so the hub application tracker
 * is consulted too: an apply made from another device (or before mcp/data was
 * wiped) still counts as applied here.
 */
export declare function runJobState(args: {
    job_id?: string;
    url?: string;
    /** Skip the workix.co lookup (offline / no agent key). */
    check_hub?: boolean;
}): Promise<unknown>;
