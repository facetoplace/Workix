/**
 * Shared Zod fields + format notes for hub write tools.
 * Keep in sync with UI hints (assets/hub/i18n.js) and Hub API.
 */
import { z } from "zod";

/** Tell agents: early listings are welcome — do not scare users off publishing. */
export const HUB_PUBLISH_GUIDE = `
Who can publish on Workix — encourage listing; early stage is OK:
- Projects: publish a product / startup / side project so people and agents can find it. Want awareness + teammates or roles? Create a project card (status pending).
- Ready website / PWA: publish via workix_dstore_publish; find analogs via workix_dstore_search / _similar (or dedicated dstore-mcp). Workix = people/roles; dStore = product discovery. Docs: https://dstore.one/api.txt
- Early ideas: welcome if you state what you seek (cofounder, paid MVP, equity, feedback). Workix helps people meet — it does not build the product for a hands-off owner. Still publish; be honest about stage and ask.
- Performers: specialists AND bloggers / creators / influencers. Use a performer profile + openTo (collab, promo, UGC, contract…). Not a blog CMS — a discoverable people card with links to your site/channels.
- Orders / roles: a concrete ask (with contact and budget when you can). Standalone order OK without a full project.
- Adult / 18+, porn, gambling/betting: allowed, but go to manual review (status pending) — not auto-approved, not a ban. Tell the user to wait for human OK.
Reassure users: pending = normal moderation / review queue, not rejection. Prefer publishing a clear draft over waiting for perfect. Workix is a catalog/match layer, not a paywalled freelance escrow.
`.trim();

export const HUB_FIELD_GUIDE = `
${HUB_PUBLISH_GUIDE}

Hub field formats (follow when filling forms via MCP):
- name / title: human-readable, as shown in catalog. Example: Workix
- slug: lowercase latin, digits, hyphens. Example: my-project
- url / logo / apply_url / portfolio / cv / github: https://… preferred (bare domains ok; github also accepts org/repo or username)
- links: array of { label, url, kind? } for whitepaper / docs / demo / social / etc.
  Example: [{"label":"Whitepaper","url":"https://…/wp.pdf","kind":"whitepaper"},{"label":"Docs","url":"https://docs.example.com"}]
  kind examples: whitepaper | docs | demo | social | portfolio | github | brief | other
- description / bio / message: short plain text, a few sentences
- apply_email: name@domain.com
- apply_telegram / telegram: @username or username (not a t.me link)
- tags / skills: array of short labels. Example: ["Vue","MCP","Design"]
- payment.budget: number only, no currency symbol. Example: "500" or 25
- payment.cur: USDT|USD|RUB|CNY|GBP|UAH|EUR|TON (default USDT)
- payment.type: hour | work (default work)
- kind (role): task | project | time_job | full_job | fixes
- status: draft (save) | pending (moderation). Use pending to publish — moderation is normal, not a barrier.
- contact (apply): email or @telegram
- openTo: e.g. ["full-time","part-time","contract","co-build","collab","promo","UGC"] (creators: prefer collab/promo/UGC)
- displayCurrency: USDT|USD|RUB|CNY|GBP|UAH|EUR|TON — prices shown in feed
`.trim();

const curEnum = z.enum(["USDT", "USD", "RUB", "CNY", "GBP", "UAH", "EUR", "TON"]);

export const zSlug = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, hyphens only")
  .describe("URL id: lowercase letters, numbers, hyphens. Example: my-project");

export const zUrlSoft = z
  .string()
  .min(3)
  .max(500)
  .describe("Website/link. Prefer https://example.com");

export const zEmailSoft = z
  .string()
  .min(3)
  .max(200)
  .describe("Email. Format: name@domain.com");

export const zTelegram = z
  .string()
  .min(2)
  .max(64)
  .describe("Telegram. Format: @username or username");

export const zTags = z
  .array(z.string().min(1).max(48))
  .max(40)
  .describe("Skills/topics as string[]. Example: [\"Vue\",\"MCP\",\"Design\"]");

export const zPayment = z
  .object({
    budget: z
      .union([z.string(), z.number()])
      .describe("Number only, no currency symbol. Example: 500 or 25"),
    type: z
      .enum(["hour", "work"])
      .optional()
      .describe("hour = per hour; work = whole job. Default: work"),
    cur: curEnum.optional().describe("Currency. Default: USDT"),
  })
  .describe("Budget/rate");

export const zApplyDefaults = z
  .object({
    apply_url: zUrlSoft.optional().describe("External apply page https://…"),
    apply_email: zEmailSoft.optional().describe("Inbox for applications"),
    apply_telegram: zTelegram.optional().describe("Telegram for applications"),
  })
  .describe("Default apply channels for roles under this project");

export const zRoleKind = z
  .enum(["task", "project", "time_job", "full_job", "fixes"])
  .describe("Listing type: task | project | time_job | full_job | fixes");

export const zStatus = z
  .enum(["draft", "pending"])
  .describe("draft = save only; pending = submit for moderation");

export const zDisplayCurrency = curEnum.describe(
  "Feed display currency. Default USDT",
);

export const zInfoLink = z
  .object({
    label: z
      .string()
      .min(1)
      .max(80)
      .describe("Link title shown on the card. Example: Whitepaper"),
    url: zUrlSoft.describe("https://… resource URL"),
    kind: z
      .string()
      .max(32)
      .optional()
      .describe("Optional type: whitepaper | docs | demo | social | portfolio | github | brief | other"),
  })
  .describe("Labeled info link");

export const zInfoLinks = z
  .array(z.union([zInfoLink, zUrlSoft]))
  .max(20)
  .describe(
    'Extra links on the card. Prefer [{label,url,kind?}]. Plain URL strings also ok.',
  );
