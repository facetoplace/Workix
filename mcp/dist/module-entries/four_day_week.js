import { fetchFourDayWeekJobs } from "../adapters/four_day_week.js";
export const meta = {
    id: "four_day_week",
    version: "1.0.0",
    platforms: ["four_day_week"],
};
export async function fetchJobs(_ctx, opts) {
    return fetchFourDayWeekJobs({
        pages: typeof opts?.pages === "number" ? opts.pages : undefined,
        remoteOnly: typeof opts?.remoteOnly === "boolean" ? opts.remoteOnly : undefined,
    });
}
