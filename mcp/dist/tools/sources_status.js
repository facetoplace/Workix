import { callFetchJobs, getAdapter } from "../adapterLoader.js";
import { pingProductRadar } from "../adapters/product_radar.js";
import { pingRssPlatform } from "../adapters/rss.js";
import { loadEnv } from "../env.js";
import { proxyPoolInfo } from "../proxyPool.js";
export async function runSourcesStatus() {
    loadEnv();
    const pool = await proxyPoolInfo();
    const rssIds = ["fl_ru", "freelance_ru", "weblancer_net", "habr_career"];
    const rss = await Promise.all(rssIds.map((id) => pingRssPlatform(id)));
    const product_radar = await pingProductRadar();
    const kworkMod = await getAdapter("kwork");
    const kworkConfigured = typeof kworkMod?.configured === "function" ? kworkMod.configured() : false;
    let kwork = { configured: kworkConfigured, skipped: true };
    if (kworkConfigured) {
        const started = Date.now();
        const r = await callFetchJobs("kwork");
        kwork = {
            configured: true,
            ok: !r.error || r.jobs.length > 0,
            items: r.jobs.length,
            ms: Date.now() - started,
            error: r.error,
            viaProxy: pool.count > 0,
        };
    }
    const fhMod = await getAdapter("freelancehunt");
    const fhConfigured = typeof fhMod?.configured === "function" ? fhMod.configured() : false;
    let freelancehunt = { configured: fhConfigured, skipped: true };
    if (fhConfigured) {
        const started = Date.now();
        const r = await callFetchJobs("freelancehunt");
        freelancehunt = {
            configured: true,
            ok: !r.error || r.jobs.length > 0,
            items: r.jobs.length,
            ms: Date.now() - started,
            error: r.error,
        };
    }
    const uwMod = await getAdapter("upwork");
    const upworkConfigured = typeof uwMod?.configured === "function" ? uwMod.configured() : false;
    let upwork = { configured: upworkConfigured, skipped: true };
    if (upworkConfigured) {
        const started = Date.now();
        const r = await callFetchJobs("upwork", { first: 5 });
        const companySelector = uwMod?.companySelector;
        const orgs = companySelector ? await companySelector() : null;
        upwork = {
            configured: true,
            ok: !r.error || r.jobs.length > 0,
            items: r.jobs.length,
            totalCount: r.totalCount,
            ms: Date.now() - started,
            error: r.error,
            company_selector: orgs,
        };
    }
    const flnMod = await getAdapter("freelancer");
    const freelancerConfigured = typeof flnMod?.configured === "function" ? flnMod.configured() : false;
    let freelancer_com = {
        configured: freelancerConfigured,
        skipped: true,
    };
    if (freelancerConfigured) {
        const started = Date.now();
        const r = await callFetchJobs("freelancer", { limit: 5 });
        freelancer_com = {
            configured: true,
            ok: !r.error || r.jobs.length > 0,
            items: r.jobs.length,
            ms: Date.now() - started,
            error: r.error,
        };
    }
    const okCount = rss.filter((r) => r.ok).length;
    return {
        proxy_pool: pool,
        rss,
        product_radar,
        kwork,
        freelancehunt,
        upwork,
        freelancer_com,
        adapters: {
            note: "Heavy board adapters are downloaded from the hub registry on first use",
        },
        summary: `RSS ok ${okCount}/${rss.length}; product_radar=${product_radar.ok ? "ok" : "fail"}; upwork=${upworkConfigured ? "on" : "off"}; freelancer=${freelancerConfigured ? "on" : "off"}`,
    };
}
