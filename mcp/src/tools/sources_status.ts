import { callFetchJobs, getAdapter } from "../adapterLoader.js";
import { loadAtsCompanies } from "../adapters/ats.js";
import { pingFunding } from "../adapters/funding.js";
import { pingInstahyre } from "../adapters/instahyre.js";
import { pingKalibrr } from "../adapters/kalibrr.js";
import { pingLaunches } from "../adapters/launches.js";
import { jobspipeUsage } from "../adapters/jobspipe.js";
import { pingProductRadar } from "../adapters/product_radar.js";
import { pingStartupRanking } from "../adapters/startupranking.js";
import { pingWantedly } from "../adapters/wantedly.js";
import {
  pingProductHunt,
  productHuntConfigured,
} from "../adapters/producthunt.js";
import { pingRssPlatform } from "../adapters/rss.js";
import { loadEnv } from "../env.js";
import { proxyPoolInfo } from "../proxyPool.js";

/** Boards that stay dark until their key is in env — and where to get one. */
const KEYED_BOARDS: ReadonlyArray<{
  platform: string;
  env: string[];
  signup: string;
}> = [
  {
    platform: "adzuna",
    env: ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"],
    signup: "https://developer.adzuna.com/",
  },
  {
    // Their dashboard spells it JOBS_PIPE_KEY; either name works.
    platform: "jobspipe",
    env: ["JOBSPIPE_API_KEY|JOBS_PIPE_KEY"],
    signup: "https://jobspipe.dev/agent",
  },
  {
    platform: "usajobs",
    env: ["USAJOBS_API_KEY", "USAJOBS_EMAIL"],
    signup: "https://developer.usajobs.gov/apirequest/",
  },
  {
    platform: "superjob",
    env: ["SUPERJOB_APP_ID"],
    signup: "https://api.superjob.ru/",
  },
  {
    platform: "careerjet",
    env: ["CAREERJET_AFFID"],
    signup: "https://www.careerjet.com/partners/",
  },
  {
    platform: "jooble",
    env: ["JOOBLE_API_KEY"],
    signup: "https://jooble.org/api/about",
  },
  {
    // Optional, unlike the rest of this list: without the token the adapter
    // still reads the public feed. The key only buys richer cards.
    platform: "producthunt",
    env: ["PRODUCTHUNT_TOKEN"],
    signup: "https://api.producthunt.com/v2/docs",
  },
];

export async function runSourcesStatus(): Promise<unknown> {
  loadEnv();
  const pool = await proxyPoolInfo();

  const rssIds = [
    "fl_ru",
    "freelance_ru",
    "weblancer_net",
    "habr_career",
    "djinni",
    "jobspresso",
      "reddit",
      "startup_jobs",
      "jobscollider",
  ];
  const rss = await Promise.all(rssIds.map((id) => pingRssPlatform(id)));
  const product_radar = await pingProductRadar();

  // Key-gated boards: read env rather than loading the modules, so status stays
  // instant and works before the adapter registry has been published.
  // "A|B" means either name is accepted; a bare name is required.
  const keyed = KEYED_BOARDS.map((b) => ({
    platform: b.platform,
    configured: b.env.every((slot) =>
      slot.split("|").some((k) => Boolean(process.env[k]?.trim())),
    ),
    env: b.env,
    signup: b.signup,
  }));

  const atsCompanies = loadAtsCompanies();

  const kworkMod = await getAdapter("kwork");
  const kworkConfigured =
    typeof kworkMod?.configured === "function" ? kworkMod.configured() : false;
  let kwork: unknown = { configured: kworkConfigured, skipped: true };
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
  const fhConfigured =
    typeof fhMod?.configured === "function" ? fhMod.configured() : false;
  let freelancehunt: unknown = { configured: fhConfigured, skipped: true };
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
  const upworkConfigured =
    typeof uwMod?.configured === "function" ? uwMod.configured() : false;
  let upwork: unknown = { configured: upworkConfigured, skipped: true };
  if (upworkConfigured) {
    const started = Date.now();
    const r = await callFetchJobs("upwork", { first: 5 });
    const companySelector = uwMod?.companySelector as
      | (() => Promise<unknown>)
      | undefined;
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
  const freelancerConfigured =
    typeof flnMod?.configured === "function" ? flnMod.configured() : false;
  let freelancer_com: unknown = {
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

  // Always pinged: without a token this reads the public Atom feed, so the
  // source is live either way and status should say so rather than "skipped".
  const producthunt = {
    ...(await pingProductHunt()),
    configured: productHuntConfigured(),
    kind: "lead",
  };
  // Keyless, so it is always pinged — five feeds in parallel, cheap.
  const funding = { ...(await pingFunding()), kind: "lead" };
  // Cloudflare rotation, so this one can take a few seconds or fail outright.
  const startupranking = { ...(await pingStartupRanking()), kind: "lead" };
  const launches = { ...(await pingLaunches()), kind: "lead" };

  // Asia — keyless public APIs, checked in parallel.
  const [wantedly, kalibrr, instahyre] = await Promise.all([
    pingWantedly(),
    pingKalibrr(),
    pingInstahyre(),
  ]);

  const okCount = rss.filter((r) => r.ok).length;
  const keyedOn = keyed.filter((k) => k.configured).length;
  return {
    proxy_pool: pool,
    rss,
    product_radar,
    producthunt,
    funding,
    startupranking,
    launches,
    asia: { wantedly, kalibrr, instahyre },
    kwork,
    freelancehunt,
    upwork,
    freelancer_com,
    ats: {
      companies: atsCompanies.length,
      providers: [...new Set(atsCompanies.map((c) => c.ats))],
      note: "Employer boards from mcp/ats-companies.json (or ATS_COMPANIES env)",
    },
    keyed_boards: keyed,
    jobspipe: jobspipeUsage(),
    adapters: {
      note: "Heavy board adapters are downloaded from the hub registry on first use",
    },
    summary: `RSS ok ${okCount}/${rss.length}; product_radar=${product_radar.ok ? "ok" : "fail"}; upwork=${upworkConfigured ? "on" : "off"}; freelancer=${freelancerConfigured ? "on" : "off"}; keyed boards ${keyedOn}/${keyed.length}; ats companies ${atsCompanies.length}`,
  };
}
