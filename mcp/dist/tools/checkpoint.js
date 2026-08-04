import { getLatestCheckpoint, listCheckpoints, setCheckpoint, } from "../store.js";
/** Save where the search/outreach session stopped. */
export async function runCheckpointSet(args) {
    if (!args.summary?.trim()) {
        return {
            error: "summary required — where we stopped (platforms done, last batch, skips)",
        };
    }
    const rec = setCheckpoint({
        summary: args.summary,
        next: args.next,
        surfaces: args.surfaces,
        batch: args.batch,
        blocked: args.blocked,
        note: args.note,
        at: args.at,
        id: args.id,
    });
    return {
        saved: true,
        checkpoint: rec,
        hint: "Mirror into docs/apply-log-*.md CHECKPOINT section so the next agent resumes without re-searching from zero.",
    };
}
/** Resume: latest checkpoint (+ optional history). */
export async function runCheckpointGet(args) {
    const latest = getLatestCheckpoint();
    const history = listCheckpoints(args.limit ?? 5);
    return {
        latest: latest ?? null,
        history,
        hint: latest
            ? "Continue from latest.next / surfaces — do not restart the whole search."
            : "No checkpoint yet — after this session call workix_checkpoint_set.",
    };
}
