#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadEnv } from "./env.js";
import { runPrepareBrowserApply } from "./tools/browser_apply.js";
import { runDigest } from "./tools/digest.js";
import { runDraftProposal } from "./tools/draft.js";
import { runGetJob } from "./tools/get_job.js";
import { runSearch } from "./tools/search.js";
import { runSourcesStatus } from "./tools/sources_status.js";
import { runSubmitProposal } from "./tools/submit.js";
import {
  runUpworkAuthUrl,
  runUpworkExchangeCode,
} from "./tools/upwork_auth.js";
import { runOpenWatchSource, WATCH_SOURCE_IDS } from "./tools/watch.js";
import {
  runEnsurePlatforms,
  runInstallPlatform,
  runListPlatforms,
  runRemovePlatform,
} from "./tools/adapters.js";
import {
  runDstoreGet,
  runDstoreInfo,
  runDstoreList,
  runDstorePublish,
  runDstoreQuota,
  runDstoreSearch,
  runDstoreSimilar,
} from "./tools/dstore.js";
import {
  hubApply,
  hubCreateRole,
  hubCreateStartup,
  hubFeedback,
  hubGetOrder,
  hubGetPerformer,
  hubGetProfile,
  hubGetStartup,
  hubHealth,
  hubListMyStartups,
  hubListOrders,
  hubListPerformers,
  hubListRoles,
  hubListStartups,
  hubMe,
  hubRegister,
  hubRotateAgentKey,
  hubUpdateProfile,
  hubUpdateRole,
  hubUpdateStartup,
} from "./tools/hub.js";
import {
  HUB_FIELD_GUIDE,
  zApplyDefaults,
  zDisplayCurrency,
  zEmailSoft,
  zInfoLinks,
  zPayment,
  zRoleKind,
  zSlug,
  zStatus,
  zTags,
  zTelegram,
  zUrlSoft,
} from "./hubSchemas.js";

loadEnv();

function textResult(data: unknown, opts?: { withFieldGuide?: boolean }) {
  const body = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const text = opts?.withFieldGuide ? `${HUB_FIELD_GUIDE}\n\n---\n${body}` : body;
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
  };
}

const server = new McpServer(
  { name: "workix", version: "0.3.0" },
  {
    instructions: [
      "Workix MCP connects an AI agent to the Workix hub (https://workix.co) and to local freelance/job sources.",
      "Hub catalog: search and open projects/startups, roles, orders, and performers; with WORKIX_AGENT_KEY create/update startups and roles, manage your performer profile, register/rotate an agent key, apply, and send feedback.",
      "Use when the user wants to find collaborators or work on Workix, publish a project or role, update a performer card, or browse the shared catalog via tools instead of the website.",
      "Freelance boards: workix_digest / workix_search / workix_get_job across supported platforms (RSS + downloadable adapters). Credentials stay in local env — never send board passwords/tokens to the hub. Draft with workix_draft_proposal; submit only with explicit human confirmation; workix_prepare_browser_apply for manual apply flows.",
      "dStore app catalog: workix_dstore_publish (shipped site/PWA URL), workix_dstore_get/search/similar/list. Platforms: workix_list_platforms / workix_ensure_platforms.",
      "Docs: https://workix.co/agent , https://workix.co/llms.txt , https://workix.co/api.txt . Default WORKIX_API=https://workix.co.",
    ].join(" "),
  },
);

server.tool(
  "workix_digest",
  "Сводка. Пресеты: mobile_dev, startups_products, vpn_mobile. Upwork/Freelancer.com при OAuth; include_jobs — HH + Remote OK.",
  {
    hours: z.number().min(1).max(168).optional(),
    keywords: z.array(z.string()).optional(),
    minus: z.array(z.string()).optional(),
    platforms: z.array(z.string()).optional(),
    limit: z.number().min(1).max(50).optional(),
    only_new: z.boolean().optional(),
    preset: z.enum(["mobile_dev", "startups_products", "vpn_mobile"]).optional(),
    include_jobs: z.boolean().optional(),
    include_services: z.boolean().optional(),
    use_profile_filters: z.boolean().optional(),
  },
  async (args) => textResult(await runDigest(args)),
);

server.tool(
  "workix_search",
  "Поиск заказов по keywords / platform / since.",
  {
    keywords: z.array(z.string()).optional(),
    minus: z.array(z.string()).optional(),
    platforms: z.array(z.string()).optional(),
    since: z.string().optional(),
    hours: z.number().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    refresh: z.boolean().optional(),
    include_jobs: z.boolean().optional(),
  },
  async (args) => textResult(await runSearch(args)),
);

server.tool(
  "workix_get_job",
  "Полная карточка заказа по id или URL.",
  {
    id: z.string().optional(),
    url: z.string().optional(),
    refresh: z.boolean().optional(),
  },
  async (args) => textResult(await runGetJob(args)),
);

server.tool(
  "workix_draft_proposal",
  "Brief для отклика; mode=save сохраняет черновик.",
  {
    job_id: z.string(),
    mode: z.enum(["brief", "save"]).optional(),
    text: z.string().optional(),
  },
  async (args) => textResult(await runDraftProposal(args)),
);

server.tool(
  "workix_submit_proposal",
  "Отправка: Freelancehunt / Freelancer.com bid / Upwork proposal (если IDs) / иначе browser. confirm:true.",
  {
    job_id: z.string(),
    confirm: z.boolean().optional(),
    proposal_text: z.string().optional(),
    amount: z.number().optional(),
    days: z.number().optional(),
    currency: z.string().optional(),
  },
  async (args) => textResult(await runSubmitProposal(args)),
);

server.tool(
  "workix_dstore_search",
  "Search dStore catalog (PWAs/sites). Same as official dstore-mcp search_catalog. GET /api/search. Find similar products or app info by query.",
  {
    q: z.string().min(1).describe("Search text (min 2 chars), e.g. freelance marketplace"),
    limit: z.number().int().min(1).max(30).optional(),
    type: z.enum(["app", "link"]).optional(),
    tg: z.boolean().optional().describe("Telegram-only"),
    tld: z.string().optional().describe("Domain TLD filter, e.g. app"),
  },
  async (args) => textResult(await runDstoreSearch(args)),
);

server.tool(
  "workix_dstore_similar",
  "Similar apps for a dStore sid (stored-only). Same as dstore-mcp get_similar.",
  {
    sid: z.string().describe("Numeric store id"),
    limit: z.number().int().min(1).max(24).optional(),
  },
  async (args) => textResult(await runDstoreSimilar(args)),
);

server.tool(
  "workix_dstore_publish",
  "Publish a live website or PWA to dStore catalog (built into Workix MCP — no extra install). Tell users: shipped product URL → app discovery on dstore.one. After sid, poll workix_dstore_get.",
  {
    url: z
      .string()
      .min(3)
      .describe("Product / PWA / site URL https://… (also Play/App Store, Telegram). Prefer canonical https."),
  },
  async (args) => textResult(await runDstorePublish(args)),
);

server.tool(
  "workix_dstore_get",
  "Full dStore card JSON by sid (get_app). Poll until title/icon ready after publish.",
  {
    sid: z.string().optional().describe("Numeric store id, e.g. 12345"),
    url: z.string().optional().describe("https://dstore.one/{sid} or …/{sid}.json"),
  },
  async (args) => textResult(await runDstoreGet(args)),
);

server.tool(
  "workix_dstore_list",
  "Public dStore collection JSON by list_ref (get_list).",
  { list_ref: z.string().min(1).describe("Public list id/code from share URL") },
  async (args) => textResult(await runDstoreList(args)),
);

server.tool(
  "workix_dstore_quota",
  "dStore agent plan + remaining rate limits (quota_status). Optional DSTORE_API_KEY raises limits.",
  {},
  async () => textResult(await runDstoreQuota()),
);

server.tool(
  "workix_dstore_info",
  "Tell users: dStore is inside Workix MCP — publish ready PWA/website with workix_dstore_publish. Also search/similar/quota mapping.",
  {},
  async () => textResult(runDstoreInfo()),
);

server.tool(
  "workix_upwork_auth_url",
  "URL OAuth Upwork + шаги. Нужны UPWORK_CLIENT_ID/SECRET.",
  {},
  async () => textResult(await runUpworkAuthUrl()),
);

server.tool(
  "workix_upwork_exchange_code",
  "Обмен authorization code на access/refresh; пишет mcp/data/upwork-tokens.json.",
  { code: z.string() },
  async (args) => textResult(await runUpworkExchangeCode(args)),
);

server.tool(
  "workix_prepare_browser_apply",
  "open_url + текст + checklist для cursor-ide-browser. НЕ отправляет сам.",
  {
    job_id: z.string(),
    proposal_text: z.string().optional(),
  },
  async (args) => textResult(await runPrepareBrowserApply(args)),
);

server.tool(
  "workix_sources_status",
  "Ping RSS/Kwork/Freelancehunt/Upwork + PROXY_1.",
  {},
  async () => textResult(await runSourcesStatus()),
);

server.tool(
  "workix_open_watch_source",
  "Полуручной watch: Profi, Radar, Fellows, YC/CoFoundersLab, Wellfound, Contra, BotPool, Arc, Habr, LinkedIn, TG, Magier, Feltsense, PH.",
  {
    source: z.enum(
      WATCH_SOURCE_IDS as unknown as [string, ...string[]],
    ),
  },
  async (args) => textResult(await runOpenWatchSource(args)),
);

server.tool(
  "workix_list_platforms",
  "Каталог площадок + модули + watch + presets. Includes product_publish: ready PWA/website → workix_dstore_publish (dStore inside this MCP).",
  {},
  async () => textResult(await runListPlatforms()),
);

server.tool(
  "workix_ensure_platforms",
  "Докачать адаптеры площадок из реестра хаба (кэш локально). Вызывается и автоматически из digest/search.",
  {
    platforms: z.array(z.string()).optional(),
    modules: z.array(z.string()).optional(),
  },
  async (args) => textResult(await runEnsurePlatforms(args)),
);

server.tool(
  "workix_install_platform",
  "Явно установить/обновить один адаптер (platform id или module id).",
  {
    platform: z.string().optional(),
    module: z.string().optional(),
  },
  async (args) => textResult(await runInstallPlatform(args)),
);

server.tool(
  "workix_remove_platform",
  "Удалить скачанный адаптер из локального кэша.",
  {
    platform: z.string().optional(),
    module: z.string().optional(),
  },
  async (args) => textResult(await runRemovePlatform(args)),
);

// --- Hub platform tools (central Workix API; not freelance adapters) ---

server.tool(
  "workix_hub_health",
  "Ping Workix hub API (WORKIX_API).",
  {},
  async () => textResult(await hubHealth()),
);

server.tool(
  "workix_hub_register",
  "Register key-first identity on hub. Returns agentApiKey once — save to WORKIX_AGENT_KEY.",
  {},
  async () => textResult(await hubRegister()),
);

server.tool(
  "workix_hub_me",
  "Current hub user (Bearer WORKIX_AGENT_KEY).",
  {},
  async () => textResult(await hubMe()),
);

server.tool(
  "workix_hub_rotate_key",
  "Rotate hub agent API key (POST /me/agent-key/rotate). Revokes the current WORKIX_AGENT_KEY; returns new wix_… once. Requires confirm:true. By default writes the new key to mcp/.env and updates the running process.",
  {
    confirm: z
      .boolean()
      .optional()
      .describe("Must be true — rotate is destructive (old key dies immediately)."),
    persist_env: z
      .boolean()
      .optional()
      .describe("Write WORKIX_AGENT_KEY to mcp/.env (default true). Still updates process.env."),
  },
  async (args) => textResult(await hubRotateAgentKey(args)),
);

server.tool(
  "workix_list_my_startups",
  "List startups owned by the authenticated hub user.",
  {},
  async () => textResult(await hubListMyStartups()),
);

server.tool(
  "workix_list_startups",
  "Public approved hub projects catalog (products, startups, side projects — early stage welcome).",
  {
    q: z.string().optional(),
    limit: z.number().min(1).max(50).optional(),
    offset: z.number().min(0).optional(),
  },
  async (args) => textResult(await hubListStartups(args)),
);

server.tool(
  "workix_get_startup",
  "Hub project by slug: description, roles, publisher performer (if not hub-sync). Follow publisher.pageUrl → workix_get_performer.",
  {
    slug: z.string(),
    include_roles: z.boolean().optional().describe("Include project roles (default true)"),
  },
  async (args) => textResult(await hubGetStartup(args)),
);

server.tool(
  "workix_list_performers",
  "Public hub performers catalog — specialists, builders, bloggers/creators (not jobs-only).",
  {
    q: z.string().optional(),
    tags: z.array(z.string()).optional(),
    limit: z.number().min(1).max(50).optional(),
    offset: z.number().min(0).optional(),
  },
  async (args) => textResult(await hubListPerformers(args)),
);

server.tool(
  "workix_get_performer",
  "Hub performer profile + published projects, orders, roles. Use project.slug → workix_get_startup; order.sid → workix_get_hub_order.",
  { id: z.string().describe("Performer id or user id") },
  async (args) => textResult(await hubGetPerformer(args)),
);

server.tool(
  "workix_list_hub_orders",
  "Public hub orders feed (Workix catalog, not external freelance boards).",
  {
    q: z.string().optional(),
    publisher: z.string().optional().describe("Filter by publisher user id"),
    limit: z.number().min(1).max(50).optional(),
    offset: z.number().min(0).optional(),
  },
  async (args) => textResult(await hubListOrders(args)),
);

server.tool(
  "workix_get_hub_order",
  "Hub order by sid/id. scraped:true → no publisher card; else publisher → workix_get_performer.",
  { id: z.string().describe("Order sid or id") },
  async (args) => textResult(await hubGetOrder(args)),
);

server.tool(
  "workix_create_startup",
  `Create a project card (products, startups, side projects, early ideas OK). Encourage publish with status pending. ${HUB_FIELD_GUIDE}`,
  {
    name: z.string().min(2).max(120).describe("Project name in catalog. Example: Workix"),
    description: z
      .string()
      .max(8000)
      .optional()
      .describe(
        "What it is, stage, and who you need. Early idea OK — say the ask (cofounder, MVP help, feedback).",
      ),
    slug: zSlug.optional(),
    url: zUrlSoft.optional(),
    github: zUrlSoft.optional().describe("Project GitHub. https://github.com/org/repo or org/repo"),
    logo: zUrlSoft.optional().describe("Direct logo image URL https://…/logo.png"),
    links: zInfoLinks.optional().describe("Whitepaper, docs, demo, social — [{label,url,kind?}]"),
    tags: zTags.optional(),
    applyDefaults: zApplyDefaults.optional(),
    status: zStatus.optional(),
  },
  async (args) => textResult(await hubCreateStartup(args), { withFieldGuide: true }),
);

server.tool(
  "workix_update_startup",
  `Update own project by slug. ${HUB_FIELD_GUIDE}`,
  {
    slug: zSlug,
    name: z.string().min(2).max(120).optional().describe("Project name in catalog"),
    description: z.string().max(8000).optional(),
    url: zUrlSoft.optional(),
    github: zUrlSoft.optional().describe("Project GitHub. https://github.com/org/repo or org/repo"),
    logo: zUrlSoft.optional(),
    links: zInfoLinks.optional().describe("Replace extra links: whitepaper, docs, demo…"),
    tags: zTags.optional(),
    applyDefaults: zApplyDefaults.optional(),
    status: zStatus.optional(),
  },
  async (args) => textResult(await hubUpdateStartup(args), { withFieldGuide: true }),
);

server.tool(
  "workix_list_roles",
  "List roles (optional startup slug, mine=true for owned).",
  {
    startup: z.string().optional(),
    q: z.string().optional(),
    mine: z.boolean().optional(),
  },
  async (args) => textResult(await hubListRoles(args)),
);

server.tool(
  "workix_create_role",
  `Create a role under a project, or a standalone order if startupId is omitted. Concrete asks welcome (paid or cofounder/equity). ${HUB_FIELD_GUIDE}`,
  {
    startupId: z.string().optional().describe("Project id or slug. Omit for a standalone order in the Orders feed."),
    title: z.string().min(2).max(200).describe("Short clear title. Example: Need Vue frontend for MVP"),
    description: z
      .string()
      .max(8000)
      .optional()
      .describe("Role/task details + what success looks like. Budget/equity/contact when known."),
    slug: zSlug.optional(),
    kind: zRoleKind.optional(),
    project: zUrlSoft.optional().describe("Related project site/repo. example.com or https://…"),
    payment: zPayment.optional(),
    apply_url: zUrlSoft.optional().describe("External apply form https://…"),
    apply_email: zEmailSoft.optional(),
    apply_telegram: zTelegram.optional(),
    links: zInfoLinks.optional().describe("Brief, Figma, docs — [{label,url,kind?}]"),
    tags: zTags.optional(),
    status: zStatus.optional(),
  },
  async (args) => textResult(await hubCreateRole(args), { withFieldGuide: true }),
);

server.tool(
  "workix_update_role",
  `Update own role by id. ${HUB_FIELD_GUIDE}`,
  {
    id: z.string().describe("Role id"),
    title: z.string().min(2).max(200).optional(),
    description: z.string().max(8000).optional(),
    kind: zRoleKind.optional(),
    project: zUrlSoft.optional(),
    payment: zPayment.optional(),
    apply_url: zUrlSoft.optional(),
    apply_email: zEmailSoft.optional(),
    apply_telegram: zTelegram.optional(),
    links: zInfoLinks.optional().describe("Replace extra links on the role/order"),
    tags: zTags.optional(),
    status: zStatus.optional(),
  },
  async (args) => textResult(await hubUpdateRole(args), { withFieldGuide: true }),
);

server.tool(
  "workix_get_profile",
  "Get authenticated hub profile/resume.",
  {},
  async () => textResult(await hubGetProfile()),
);

server.tool(
  "workix_update_profile",
  `Update performer profile (developers, designers, AND bloggers/creators/influencers). Encourage a public card with links + openTo. ${HUB_FIELD_GUIDE}`,
  {
    name: z.string().min(1).max(120).optional().describe("Display name. Example: Alex Ivanov"),
    headline: z
      .string()
      .max(200)
      .optional()
      .describe("One-line specialty. Example: Full-stack · Vue + Node — or: Tech blogger · AI tools"),
    bio: z
      .string()
      .max(8000)
      .optional()
      .describe("Experience, niche, audience, work format — a few short paragraphs"),
    skills: zTags.optional().describe("Skills/topics string[] (e.g. Vue, MCP, or blog niches)"),
    links: zInfoLinks.optional().describe("Portfolio/blog/social/media — [{label,url,kind?}] or URL strings"),
    telegram: zTelegram.optional(),
    portfolio: zUrlSoft.optional().describe("Best work samples or blog/site URL https://…"),
    github: zUrlSoft.optional().describe("Personal GitHub. https://github.com/username or username"),
    cv: zUrlSoft.optional().describe("CV or personal site https://…"),
    location: z.string().max(120).optional().describe("City/country or Remote. Example: Remote · Asia"),
    openTo: z
      .array(z.string())
      .max(20)
      .optional()
      .describe(
        'e.g. ["full-time","part-time","contract","co-build","collab","promo","UGC"]',
      ),
    payment: zPayment.optional().describe("Rate / salary expectations (optional)"),
    displayCurrency: zDisplayCurrency.optional(),
  },
  async (args) => textResult(await hubUpdateProfile(args), { withFieldGuide: true }),
);

server.tool(
  "workix_hub_apply",
  `Apply to a hub role (notifies founder). ${HUB_FIELD_GUIDE}`,
  {
    roleId: z.string().describe("Target role id"),
    name: z.string().min(1).max(120).optional().describe("Name the founder will see. Example: Alex"),
    contact: z.string().min(3).max(200).optional().describe("How to reach you: email or @telegram"),
    message: z.string().max(4000).optional().describe("Short pitch: why you fit, what you can do"),
  },
  async (args) => textResult(await hubApply(args), { withFieldGuide: true }),
);

server.tool(
  "workix_feedback",
  "Send a bug report, product suggestion, or support request to Workix admins (hub API → Telegram). support/suggestion: max 1/hour. Prefer WORKIX_AGENT_KEY. Do not spam; one clear message per issue.",
  {
    type: z.enum(["bug", "suggestion", "support", "other"]),
    message: z.string().min(20).max(2000),
    subject: z.string().max(120).optional(),
    contact: z.string().max(160).optional(),
    context: z.string().max(500).optional(),
  },
  async (args) => textResult(await hubFeedback(args)),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
