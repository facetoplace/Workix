import { refreshJobs } from "../fetchJobs.js";
import { getPreset } from "../presets.js";
import { parseProfileFilters } from "../profile.js";
import { cardSummary, digestText, filterJobs } from "../summarize.js";
import { markDigestShown, wasShownInDigest } from "../store.js";
import { runOpenWatchSource } from "./watch.js";
export async function runDigest(args) {
    const preset = args.preset ? getPreset(args.preset) : undefined;
    const profile = args.use_profile_filters === false ? null : parseProfileFilters();
    const hours = args.hours ?? preset?.hours ?? 12;
    const limit = args.limit ?? preset?.limit ?? 20;
    const onlyNew = args.only_new !== false;
    const keywords = args.keywords ??
        preset?.keywords ??
        (profile?.keywords.length ? profile.keywords : undefined);
    const minus = args.minus ??
        preset?.minus ??
        (profile?.minus.length ? profile.minus : undefined);
    const include_jobs = args.include_jobs ?? preset?.include_jobs ?? false;
    const include_services = args.include_services ?? preset?.include_services ?? false;
    const platforms = args.platforms ?? preset?.platforms;
    const hh_text = keywords?.slice(0, 5).join(" ") || undefined;
    const upwork_query = keywords?.slice(0, 6).join(" OR ") || undefined;
    const freelancer_query = upwork_query;
    const { jobs, errors } = await refreshJobs({
        platforms,
        include_jobs,
        hh_text,
        upwork_query,
        freelancer_query,
    });
    let filtered = filterJobs(jobs, {
        hours,
        keywords,
        minus,
        platforms,
        min_budget: profile?.min_budget,
    });
    if (onlyNew) {
        filtered = filtered.filter((j) => !wasShownInDigest(j.id));
    }
    const top = filtered.slice(0, limit);
    const cards = top.map((j) => cardSummary(j, keywords));
    markDigestShown(top.map((j) => j.id));
    const summary = digestText(cards, {
        hours,
        errors,
        preset: args.preset,
    });
    let watch;
    if (include_services || (preset?.watch_sources?.length && args.preset === "startups_products")) {
        const sources = preset?.watch_sources || ["profi", "product_radar", "startupfellows"];
        watch = {
            hint: "Полуручной watch — открой через workix_open_watch_source",
            sources: await Promise.all(sources.map((id) => runOpenWatchSource({ source: id }))),
        };
    }
    return {
        summary,
        count: cards.length,
        total_matched: filtered.length,
        cards,
        errors,
        filters: { keywords, minus, include_jobs, include_services, hours },
        watch,
    };
}
