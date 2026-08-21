import { getLatestCheckpoint } from "../store.js";
const FALLBACK_DAYS = 30;
export function telegramSearchSince(explicit) {
    if (explicit?.trim()) {
        const parsed = new Date(explicit);
        if (!Number.isNaN(parsed.getTime())) {
            return { since: parsed.toISOString(), source: "explicit" };
        }
    }
    const checkpoint = getLatestCheckpoint();
    if (checkpoint?.at && !Number.isNaN(new Date(checkpoint.at).getTime())) {
        return { since: new Date(checkpoint.at).toISOString(), source: "checkpoint" };
    }
    return {
        since: new Date(Date.now() - FALLBACK_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        source: "fallback_30d",
    };
}
