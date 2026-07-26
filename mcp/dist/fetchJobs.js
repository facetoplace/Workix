import { fetchFreelancerJobs } from "./adapters/freelancer.js";
import { fetchFreelancehuntJobs } from "./adapters/freelancehunt.js";
import { fetchHhJobs } from "./adapters/hh.js";
import { fetchKworkJobs } from "./adapters/kwork.js";
import { fetchRemoteOkJobs } from "./adapters/remoteok.js";
import { fetchRssJobs } from "./adapters/rss.js";
import { fetchUpworkJobs } from "./adapters/upwork.js";
import { upsertJobs } from "./store.js";
export async function refreshJobs(opts) {
    const platforms = opts?.platforms;
    const errors = [];
    const collected = [];
    const wantRss = !platforms?.length ||
        platforms.some((p) => ["fl_ru", "freelance_ru", "weblancer_net"].includes(p));
    const rssIds = platforms?.filter((p) => ["fl_ru", "freelance_ru", "weblancer_net"].includes(p));
    if (wantRss) {
        const rss = await fetchRssJobs(rssIds?.length ? rssIds : undefined);
        collected.push(...rss.jobs);
        for (const e of rss.errors)
            errors.push(`${e.platform}: ${e.error}`);
    }
    const wantKwork = opts?.includeKwork !== false &&
        (!platforms?.length || platforms.includes("kwork"));
    if (wantKwork) {
        const kw = await fetchKworkJobs();
        collected.push(...kw.jobs);
        if (kw.error && !kw.error.includes("optional") && !kw.error.includes("missing")) {
            errors.push(`kwork: ${kw.error}`);
        }
    }
    const wantFh = opts?.include_freelancehunt !== false &&
        (!platforms?.length || platforms.includes("freelancehunt"));
    if (wantFh) {
        const fh = await fetchFreelancehuntJobs();
        collected.push(...fh.jobs);
        if (fh.error && !fh.error.includes("optional") && !fh.error.includes("missing")) {
            errors.push(`freelancehunt: ${fh.error}`);
        }
    }
    if (opts?.include_jobs) {
        const wantHh = !platforms?.length || platforms.includes("hh");
        const wantRok = !platforms?.length || platforms.includes("remoteok");
        if (wantHh) {
            const hh = await fetchHhJobs({ text: opts.hh_text });
            collected.push(...hh.jobs);
            if (hh.error)
                errors.push(`hh: ${hh.error}`);
        }
        if (wantRok) {
            const rok = await fetchRemoteOkJobs();
            collected.push(...rok.jobs);
            if (rok.error)
                errors.push(`remoteok: ${rok.error}`);
        }
    }
    const wantUpwork = opts?.include_upwork !== false &&
        (!platforms?.length || platforms.includes("upwork"));
    if (wantUpwork) {
        const uw = await fetchUpworkJobs({ query: opts?.upwork_query });
        collected.push(...uw.jobs);
        if (uw.error &&
            !uw.error.includes("optional") &&
            !uw.error.includes("missing")) {
            errors.push(`upwork: ${uw.error}`);
        }
    }
    const wantFln = opts?.include_freelancer !== false &&
        (!platforms?.length || platforms.includes("freelancer_com"));
    if (wantFln) {
        const fln = await fetchFreelancerJobs({ query: opts?.freelancer_query });
        collected.push(...fln.jobs);
        if (fln.error &&
            !fln.error.includes("optional") &&
            !fln.error.includes("missing")) {
            errors.push(`freelancer_com: ${fln.error}`);
        }
    }
    const stored = upsertJobs(collected);
    return { jobs: stored, errors };
}
