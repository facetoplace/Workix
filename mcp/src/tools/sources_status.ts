import { kworkConfigured, fetchKworkJobs } from "../adapters/kwork.js";
import { freelancehuntConfigured, fetchFreelancehuntJobs } from "../adapters/freelancehunt.js";
import {
  fetchFreelancerJobs,
  freelancerConfigured,
} from "../adapters/freelancer.js";
import {
  fetchUpworkJobs,
  upworkCompanySelector,
  upworkConfigured,
} from "../adapters/upwork.js";
import { pingRssPlatform } from "../adapters/rss.js";
import { loadEnv } from "../env.js";
import { proxyPoolInfo } from "../proxyPool.js";

export async function runSourcesStatus(): Promise<unknown> {
  loadEnv();
  const pool = await proxyPoolInfo();

  const rssIds = ["fl_ru", "freelance_ru", "weblancer_net"];
  const rss = await Promise.all(rssIds.map((id) => pingRssPlatform(id)));

  let kwork: unknown = { configured: kworkConfigured(), skipped: true };
  if (kworkConfigured()) {
    const started = Date.now();
    const r = await fetchKworkJobs();
    kwork = {
      configured: true,
      ok: !r.error || r.jobs.length > 0,
      items: r.jobs.length,
      ms: Date.now() - started,
      error: r.error,
      viaProxy: pool.count > 0,
    };
  }

  let freelancehunt: unknown = {
    configured: freelancehuntConfigured(),
    skipped: true,
  };
  if (freelancehuntConfigured()) {
    const started = Date.now();
    const r = await fetchFreelancehuntJobs();
    freelancehunt = {
      configured: true,
      ok: !r.error || r.jobs.length > 0,
      items: r.jobs.length,
      ms: Date.now() - started,
      error: r.error,
    };
  }

  let upwork: unknown = { configured: upworkConfigured(), skipped: true };
  if (upworkConfigured()) {
    const started = Date.now();
    const r = await fetchUpworkJobs({ first: 5 });
    const orgs = await upworkCompanySelector();
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

  let freelancer_com: unknown = {
    configured: freelancerConfigured(),
    skipped: true,
  };
  if (freelancerConfigured()) {
    const started = Date.now();
    const r = await fetchFreelancerJobs({ limit: 5 });
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
    kwork,
    freelancehunt,
    upwork,
    freelancer_com,
    summary: `RSS ok ${okCount}/${rss.length}; upwork=${upworkConfigured() ? "on" : "off"}; freelancer=${freelancerConfigured() ? "on" : "off"}`,
  };
}
