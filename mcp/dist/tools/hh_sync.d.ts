import type { OutreachStatus } from "../types.js";
interface NegotiationItem {
    vacancy?: string;
    employer?: string;
    state?: string;
    raw_state?: string;
    rejected?: boolean;
    invited?: boolean;
    unread_messages?: boolean;
    question_pending?: boolean;
    messages?: number;
    applied_at?: string;
    last_change?: string;
    vacancy_url?: string;
}
/**
 * hh's state machine → the outreach vocabulary (draft|sent|ok|skip|reply|blocked).
 * A rejection is `blocked`: the door is shut from the other side, which is what
 * that status means for every other channel. `skip` is for the one case where
 * the applicant withdrew — that was our own decision not to pursue it.
 */
export declare function outreachStatusForNegotiation(item: NegotiationItem): OutreachStatus;
export declare function runHhSyncOutreach(args: {
    /** Pages of the negotiations list to walk. Default 10 (~200 topics). */
    pages?: number;
    /** Report what would be written without touching the log. */
    dry_run?: boolean;
}): Promise<unknown>;
export {};
