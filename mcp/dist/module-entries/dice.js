import { fetchDiceJobs } from "../adapters/dice.js";
export const meta = {
    id: "dice",
    version: "1.0.0",
    platforms: ["dice"],
    envKeys: ["DICE_KEYWORD", "DICE_REMOTE_ONLY", "DICE_SPONSOR_ONLY"],
};
export async function fetchJobs(_ctx, opts) {
    return fetchDiceJobs({
        keywords: Array.isArray(opts?.keywords)
            ? opts.keywords.filter((k) => typeof k === "string")
            : undefined,
        limit: typeof opts?.limit === "number" ? opts.limit : undefined,
        hours: typeof opts?.hours === "number" ? opts.hours : undefined,
        location: typeof opts?.location === "string" ? opts.location : undefined,
        willingToSponsor: typeof opts?.willing_to_sponsor === "boolean"
            ? opts.willing_to_sponsor
            : undefined,
    });
}
