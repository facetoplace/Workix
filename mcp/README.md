# Workix MCP

Local MCP server for AI agents ([Cursor](https://cursor.com), Claude, etc.) that work with the [Workix hub](https://workix.co) and freelance boards.

Workix is a shared catalog where **projects** (startups/products/communities), **roles & orders**, and **performers** find each other. It is not a closed freelance marketplace: listings point to the owner’s preferred contact or apply flow. Agents use this MCP to search that catalog, manage your listings, and also pull opportunities from external boards while keeping platform credentials on the user’s machine.

**Install (recommended):** clone this repo → `mcp/` → `npm install && npm run build` · Docs: [workix.co/agent](https://workix.co/agent) · [api.txt](https://workix.co/api.txt) · [llms.txt](https://workix.co/llms.txt)  
Optional shortcut: `npx -y @workix/mcp` (npm may lag behind git).

### Where it is published

| Channel | Link / id |
|---------|-----------|
| npm | [@workix/mcp](https://www.npmjs.com/package/@workix/mcp) |
| Official MCP Registry | [`co.workix/mcp`](https://registry.modelcontextprotocol.io/v0.1/servers?search=co.workix/mcp) |
| Source | [facetoplace/Workix](https://github.com/facetoplace/Workix) → `mcp/` |
| Dataset | [workix/workix-mcp](https://huggingface.co/datasets/workix/workix-mcp) on Hugging Face |
| Community catalogs | [mcp.so](https://mcp.so/) · [mcpservers.org](https://mcpservers.org/) · [mcpmarket.com](https://mcpmarket.com/) |

### Dataset

[**workix/workix-mcp**](https://huggingface.co/datasets/workix/workix-mcp) — open dataset generated from this server's own tool definitions (Apache-2.0), in three configs:

| Config | Rows | What |
|--------|------|------|
| `qa` | 83 | hand-written Q&A in en/ru/es: what Workix is, what data it exposes, how clients use it |
| `calls` | 144 | `user prompt → assistant tool_call` in OpenAI messages format |
| `tools` | 54 | the raw tool catalog: name, description, JSON Schema |

```python
from datasets import load_dataset
qa = load_dataset("workix/workix-mcp", "qa", split="train")
```

Regenerate after changing the tool surface — it reads `tools/list` off the running server:

```bash
node scripts/dump-tools.mjs
HF_REPO=workix/workix-mcp node scripts/dataset-build.mjs
```

Sources: [`scripts/dump-tools.mjs`](./scripts/dump-tools.mjs) · [`scripts/dataset-build.mjs`](./scripts/dataset-build.mjs) · seeds in [`scripts/dataset-qa.json`](./scripts/dataset-qa.json)

### What you can use it for

- **Discover** — search hub projects, roles, orders, and performers relevant to a skill or niche
- **Publish / update** — create or edit a startup or role, maintain a performer profile (`WORKIX_AGENT_KEY`)
- **Freelance workflow** — digests and search across supported boards, draft proposals, prepare browser apply steps (submit only with human confirmation)
- **Ship a product card** — publish a live site/PWA URL into the dStore catalog and find similar apps

- **Hub tools** — search/list/create projects, roles, profile; feedback/support (needs `WORKIX_AGENT_KEY`)
- **Board tools** — digest / search / draft / prepare-apply on Upwork, Freelancehunt, Kwork, FL RSS, … (credentials stay in your env)
- **Downloadable adapters** — heavy board modules are **not** required at install; MCP downloads them from the hub registry on first use and caches locally

Open contribution: see [CONTRIBUTING.md](./CONTRIBUTING.md) (adapters + **Telegram channels catalog** PRs). Agent prompt & storefront: [../README.md](../README.md).

**Telegram channels:** shared list [`telegram-channels.example.json`](./telegram-channels.example.json) — how to add via PR: [TELEGRAM-CHANNELS.md](./TELEGRAM-CHANNELS.md).

## What the agent remembers, and how to read it

All local state is in the SQLite file below. It is what stops a second session
from re-applying to a job, re-posting a card, or showing the same digest twice.

| What | Table | Read it with | Written by |
|------|-------|--------------|------------|
| Job cards | `jobs` | `workix_search`, `workix_get_job` | `workix_digest` / `workix_search` while collecting |
| Already shown in a digest | `shown_digest` | `workix_job_state` → `shown_in_digest` | `workix_digest` marks them; `only_new` (default) then hides them |
| Where we applied, and the status | `outreach` | `workix_outreach_list` (`job_id`, `contact`, `channel`, `status`) | **`workix_outreach_log`** — required after any draft or send |
| Proposal drafts | `drafts` | `workix_job_state` → `draft` | `workix_draft_proposal` |
| Already mirrored to workix.co | `hub_shares` | `workix_hub_share_status`, `workix_history` | `workix_share_jobs`, `workix_digest share_to_hub:true` |
| Where the last session stopped | `checkpoints` | `workix_checkpoint_get` | `workix_checkpoint_set` |
| Board response cache | `fetch_cache` | `workix_store_status` | collection; `force_refresh:true` bypasses |

**One call before acting on a card:**

```bash
workix_job_state {"job_id": "1ca5ff1099b3ca91"}   # or {"url": "https://…"}
```

It returns whether the card was shown in a digest and when, whether it is already
on workix.co (sid + link), whether a draft exists, every apply attempt with its
status, the hub tracker row (`hub_application`, so an apply made on another
machine also counts), and a `next` list of what is left. Call it before
`workix_draft_proposal`, `workix_submit_proposal` and `workix_share_jobs`.

**Applications live on the hub too.** The local `outreach` table only knows this
machine. `workix_track_apply` records the application on workix.co: it publishes
the job into the catalog if it is missing, stores status + date + the text that
was sent (privately — the listing shows only an anonymous counter), and mirrors
the row locally. `workix_submit_proposal` calls it automatically when the agent
sends the proposal itself. When the human applied by hand, **ask them for the
text they sent** and pass it as `text` with `via: "user"` — their own wording is
the best base for the next proposal, which is what `workix_list_applies` is for.
`workix_sync_applies` pulls the history back into a fresh local store, and
`workix_delete_apply` (needs `confirm: true`) removes a row that should not be
there — the mirrored job stays in the catalog, since that listing is public board
content rather than part of your private log.

| Funnel status | Meaning |
|---------------|---------|
| `draft` | prepared, not sent — excluded from the public counter |
| `sent` → `viewed` | delivered; the other side opened it |
| `reply` → `interview` → `offer` → `hired` | it is going somewhere |
| `rejected` / `closed` | over |

**Mirroring is not applying.** `workix_share_jobs` writes an outreach row with
`channel: "hub"` so the mirror is auditable, but those rows are catalog copies,
not messages to a client. `workix_job_state` keeps them out of `outreach` and out
of `applied`, and reports them under `hub_share` instead — otherwise a reposted
card would look like one you had already answered.

**Outreach statuses:** `draft` (written, not sent) · `sent` · `ok` (confirmed
delivered/accepted) · `reply` (client answered) · `skip` (decided against it) ·
`blocked` (the platform refused — KYC, connects, ban). Log `draft` when the text
is generated, then update the **same id** to `sent`/`ok` once the user approves
and it actually goes out.

**Session shape:** open with `workix_checkpoint_get` so search resumes instead of
restarting; close (or pause, or switch platform) with `workix_checkpoint_set`
carrying what was done, what is next, which surfaces are finished, and what is
blocked.

## Local store and shared cache

Everything local lives in one SQLite file, `$WORKIX_MCP_DATA/workix.db` (default `mcp/data/`):
job cards, drafts, the outreach log, checkpoints, hub shares, and the board response
cache. It uses `node:sqlite`, which ships with Node — nothing compiles at install time, but
it does mean **Node 22.5+**.

An existing `store.json` is imported on first start and renamed to `store.json.migrated`;
the import runs once and the original is left on disk in case you want it back.

**Why not the old JSON file.** Every read parsed the whole store, so a 13MB file cost ~126ms
per call — and `wasShownInDigest()` sits inside a filter loop, which turned a digest into a
minute of pure parsing. It was also unsafe with more than one session: each MCP process did
read-modify-write on the same file, so concurrent writes were lost, and a torn write made the
loader fall back to an empty store and discard everything on the next save. Measured after
the move: 500 `wasShownInDigest` calls went from ~63s to **9ms**.

**The cache is what makes a second session cheap.** Board responses are keyed by source plus
the parameters that shaped the request, so two sessions searching the same thing share one
fetch. Measured on a full `include_jobs` run: **252s cold → 16.5s warm**, and a separate
process sees the same cache because it is on disk rather than in memory.

TTL is per source class, not global — a public RSS feed is cheap to re-read, a metered API is
not, so JobsPipe holds results for hours while a feed holds them for minutes. Only successful,
non-empty results are cached: a blocked board retries next run instead of staying dark.

```bash
workix_store_status                                  # rows, db size, what the cache is serving
workix_store_status {"prune_cache": true}            # drop expired entries
workix_store_status {"prune_jobs_days": 30}          # drop old cards with no work attached
workix_store_status {"clear_cache": "jobspipe"}      # or "all"
```

`force_refresh: true` on `workix_digest` / `workix_search` bypasses the cache for one run.
Both report `served_from_cache` with each source's age, so a stale-looking digest is
explainable rather than mysterious. Pruning never removes a card that carries work — anything
shared to the hub, drafted, or referenced by an outreach entry stays regardless of age.

## Downloadable platform modules

Core MCP always includes hub tools + **RSS** (FL / Weblancer / Djinni / Jobspresso / Reddit), Freelance.ru HTML (`/task` via RU SOCKS5), Product Radar hiring HTML (`/category/hiring/?page=N`, direct), **Habr Career** (frontend JSON, RSS fallback) and **employer ATS boards** (the company list is a repo file, so it cannot travel in a module).

Other boards ship as modules from the hub — **36** of them, covering **64** catalogued platforms:

| Registry | https://workix.co/mcp/registry.json |
| Artifacts | https://workix.co/mcp/adapters/`<id>-<version>`.tgz |
| Local cache | `$WORKIX_MCP_DATA/adapters/<id>/<version>/` (default `mcp/data/adapters`) |

On `workix_digest` / `workix_search`, MCP calls `ensure` for needed platforms, verifies **sha256**, extracts, and `import()`s the module. Later runs reuse the cache.

**Trust model:** a module is executable code inside the MCP process. Downloads are limited to **https** hosts on an allowlist (`workix.co` + registry host; override with `WORKIX_MCP_TRUSTED_HOSTS`). Size is capped; tarball paths cannot escape the install dir. `sha256` in the registry only proves integrity against that registry — if the hub itself is compromised, treat it as RCE on every client that installs. Mitigations: keep registry on a host you control, prefer bundled `assets/mcp/adapters/*.tgz` when present, set `WORKIX_MCP_REGISTRY` to a local file for air‑gapped installs. Opt-out for custom registries: `WORKIX_MCP_ALLOW_UNTRUSTED_REGISTRY=1`.

| Tool | Role |
|------|------|
| `workix_list_platforms` | Catalog + `installed` / `available` / `needs_env` |
| `workix_ensure_platforms` | Download modules for given platforms |
| `workix_install_platform` | Force install/update one module |
| `workix_remove_platform` | Delete from local cache |

Override registry: `WORKIX_MCP_REGISTRY` (file path or URL). Offline fallback: `assets/mcp/registry.json` next to the repo / `mcp/registry.local.json` after `npm run pack:adapters`.

## Contribute an adapter

```text
mcp/
  platforms.json                 # platform id + "module": "<id>"
  src/adapters/<id>.ts           # fetch + normalize jobs
  src/module-entries/<id>.ts     # downloadable entry (meta + fetchJobs)
  scripts/pack-adapters.mjs      # → assets/mcp/adapters/*.tgz + registry.json
  src/tools/                     # MCP tool handlers
  src/index.ts                   # tool registration
  .env.example                   # document new env keys
```

After changing an adapter:

```bash
npm run build
npm run pack:adapters
```

PRs: new boards, better ranking, presets (`presets.json`), tests, docs. Never commit secrets or `data/` dumps.

## Adding or removing a platform — we work with everyone

Workix plays no favourites. If you run a **job board**, a **freelance marketplace**, your own
**MCP server**, or a **Telegram channel with vacancies**, we are glad to include it — no
partnership, contract or payment involved.

**[Open an issue](https://github.com/facetoplace/Workix/issues)** and it goes both ways:

- **Add me** — name the source and how to reach it: public API, RSS feed, MCP endpoint, channel
  link. That is the whole requirement.
- **Remove me** — if you own the platform and would rather we did not read it, say so. We take
  it out, no argument about what your terms do or do not allow.
- **Fix my entry** — wrong limits, wrong attribution, wrong description of your terms: tell us
  and we correct it.

We honour attribution where it is required (Himalayas, Jobicy, Aquent), always link the
employer's original apply URL rather than a copy, and never submit an application without an
explicit human go-ahead.

The full catalogue of what is supported today — and of every third-party MCP server we probed,
integrated or turned down — lives in
[`docs/16-sources-and-partners.md`](../docs/16-sources-and-partners.md).

## Install

Needs **Node 22.5 or newer** — the local store uses the built-in `node:sqlite`, which keeps
this dependency-free rather than pulling in a native SQLite module that has to compile on
every machine.

```bash
cd mcp
npm install
npm run build
# optional: refresh local registry tarballs from source
npm run pack:adapters
```

On Windows ARM, native scripts may be disabled (`.npmrc`: `ignore-scripts=true`) because of optional native deps.

## Cursor `mcp.json`

Recommended (from source — always the freshest build):

```json
{
  "mcpServers": {
    "workix": {
      "command": "node",
      "args": ["FULL/PATH/TO/Workix/mcp/dist/index.js"],
      "env": {
        "WORKIX_API": "https://workix.co",
        "WORKIX_AGENT_KEY": "wix_…"
      }
    }
  }
}
```

Optional npm shortcut: `"command": "npx"`, `"args": ["-y", "@workix/mcp"]` (may lag behind the GitHub `mcp/` tree).

Optional board credentials (examples — see `.env.example`):

- `UPWORK_CLIENT_ID` / `UPWORK_CLIENT_SECRET` / OAuth flow tools
- `FREELANCEHUNT_TOKEN`
- `KWORK_LOGIN` / `KWORK_PASSWORD` / `KWORK_PHONE4` / `KWORK_PROXY`
- Proxy pool: `PROXY_1=` (subscription URL or socks/http list)

Never send platform passwords to the hub — only to this local process.

## Profile

```bash
cp profile.example.md profile.md
```

Optional: `WORKIX_PROFILE_PATH`, `WORKIX_MCP_DATA`.

## Hub tools (need WORKIX_API; writes need WORKIX_AGENT_KEY)

| Tool | Role |
|------|------|
| `workix_hub_health` / `workix_hub_register` / `workix_hub_me` / `workix_hub_rotate_key` | Auth & health (`rotate_key` needs `confirm:true`; writes `mcp/.env` by default) |
| `workix_list_startups` / `workix_get_startup` / `workix_create_startup` / `workix_update_startup` | Projects — products, startups, early ideas OK (`pending` = publish) |
| `workix_list_performers` / `workix_get_performer` | Performers (builders + bloggers/creators) + their listings |
| `workix_list_hub_orders` / `workix_get_hub_order` | Hub orders (`scraped` / `external` → no personal publisher card; detail may include `external`) |
| `workix_list_roles` / `workix_create_role` / `workix_update_role` | Roles / orders (concrete asks; paid or cofounder) |
| `workix_share_jobs` | Mirror local board job ids → hub catalog (`POST /orders/share`; prefer digest flag) |
| `workix_get_profile` / `workix_update_profile` | Create/update own performer card via MCP; claim vanity `slug` → shareable `https://workix.co/{slug}` + free CV PDF `https://workix.co/{slug}/pdf` (also `/{slug}.json`) |

Write tools echo a short **who can publish** guide: early stage welcome; moderation (`pending`) is normal — do not discourage listing.
| `workix_hub_apply` | Apply on hub |
| `workix_feedback` | bug / suggestion / support / other → hub admins (rate-limited) |

**Rate limits (429):** hub and dStore errors include `rateLimited: true`, human `message`, `retryAfterSec`, optional `limits`, and an agent `hint` — do not retry until the cooldown passes.

## Board tools (local credentials)

| Tool | Role |
|------|------|
| `workix_dstore_search` / `_similar` / `_get` / `_publish` / `_list` / `_quota` | [dStore](https://dstore.one) catalog — same REST as official **dstore-mcp** ([api.txt](https://dstore.one/api.txt)) |
| _(optional)_ separate MCP `dstore` | `search_catalog`, `get_app`, `get_similar`, `add_url`, `get_list`, `quota_status` — see api.txt §0 |
| `workix_digest` / `workix_search` / `workix_get_job` | Read boards (auto-downloads adapters). `share_to_hub:true` on digest batch-mirrors cards to hub (no per-item confirm; needs `WORKIX_AGENT_KEY`) |
| `workix_draft_proposal` | Draft reply |
| `workix_outreach_log` / `workix_outreach_list` | Local log: contact, channel, full text, status (`draft`/`sent`/`ok`…). Mirror into `docs/apply-log-*.md` |
| `workix_track_apply` | The application actually went out → record it on workix.co (publishes the job if missing, stores status + date + the sent text, privately) |
| `workix_list_applies` / `workix_update_apply` / `workix_sync_applies` | Cross-device apply history and past texts · move the funnel · pull the history into a fresh local store |
| `workix_checkpoint_set` / `workix_checkpoint_get` | Search pause/resume: where stopped, next, surfaces. Mirror CHECKPOINT in apply-log |
| `workix_hub_share_status` / `workix_history` | What is already on workix.co vs local-only; unified hubShares + outreach + checkpoints |
| `workix_submit_proposal` | Submit only with `confirm: true` after human OK |
| `workix_prepare_browser_apply` | Browser checklist |
| `workix_sources_status` / `workix_list_platforms` / `workix_open_watch_source` | Status & watch |
| `workix_ensure_platforms` / `workix_install_platform` / `workix_remove_platform` | Adapter cache |
| `workix_upwork_auth_url` / `workix_upwork_exchange_code` | Upwork OAuth |
| `workix_tg_status` / `workix_tg_auth` / `workix_tg_search` | Optional Telegram (GramJS; TDLib where native works). Install: `npm install telegram`. Env: `TG_APP_API_ID` + `TG_APP_API_HASH`. Login: `npm run tg:login`. |

### hh.ru session

Полная инструкция: **[HH.md](./HH.md)**. Логин в браузере, статусы откликов,
чтение переписки, полуручная отправка.

```bash
cd mcp
npm run hh:login    # логин/пароль вводишь сам в окне Chrome
npm run hh:check    # проверить сессию
```

`api.hh.ru` анонимно отдаёт 403, поэтому поиск идёт через залогиненный сайт;
куки и профиль лежат только в `mcp/data/` и на хаб не уходят.

Перед тем как автоматизировать отклики — **прочитай раздел «Три грабли»** в
[HH.md](./HH.md). Клик по «Откликнуться» может сам по себе быть откликом,
поле хранит черновик, а `page.type()` отправляет форму на переводах строк.
Каждая из этих трёх особенностей уже стоила реального отклика.

### Optional Telegram

Полная инструкция: **[TELEGRAM.md](./TELEGRAM.md)**. На **Windows ARM64** — только GramJS (`telegram`), не `prebuilt-tdlib`.

```bash
cd mcp
npm install telegram
# TG_APP_API_ID + TG_APP_API_HASH in .env
npm run tg:login          # phone/code в терминале
# restart MCP → workix_tg_status → workix_tg_search
```

### Job boards on `include_jobs` (added 2026-08-09)

No flag beyond `include_jobs: true`, no key:

| Source | Region | Endpoint |
|--------|--------|----------|
| **Trudvsem** (Работа России) | RU | open data `/api/v1/vacancies` — 514k live postings |
| **Employer ATS boards** | global | Greenhouse · Ashby · Lever · SmartRecruiters · Workable, one call per company |
| **Djinni** | UA/EU | `djinni.co/jobs/rss/` |
| **NoFluffJobs** | PL/EU | `/api/joboffers/main` (3.7MB, not the 140MB `/api/posting`) |
| **Landing.jobs** | PT/EU | `/api/v1/jobs` |
| **Get on Board** | LATAM | `/api/v0/search/jobs` |
| **Jobspresso** | global remote | `?feed=job_feed` |
| **Reddit** | global | Atom only — the JSON API is OAuth-gated and 403s datacenter IPs |
| **getmatch** (added 2026-08-10) | RU / relocate | `/api/offers` — open salary on most cards, no server-side search |
| **HN "Who is hiring?"** (added 2026-08-10) | global | the monthly thread via `hn.algolia.com/api/v1` |

| **Dice** (added 2026-08-10) | US tech-only | its own MCP server — see below |

Two notes on getmatch and HN. **getmatch** has no server-side search at all — `q`, `search`,
`text`, `query` and `sq` are silently dropped, so `keywords` are matched here over a page pulled
in full (`GETMATCH_LIMIT`, default 100 of 750). **HN** keeps only top-level comments of the
"Who is hiring?" thread: a reply is discussion, not a posting, and the thread's own rule that
posters must be hiring directly is why it carries no recruiter spam and a live contact in the
body. `HN_HIRING_STORY=<id>` reads a specific month instead of the current one.

ATS coverage is the company list in [`ats-companies.json`](./ats-companies.json) — add rows to
widen it, or override the file with `ATS_COMPANIES=greenhouse:stripe,ashby:linear`. The apply
URL is the employer's own board, so it never goes stale the way an aggregator copy does.

### Boards that only speak MCP

Some boards ship no public REST API at all — their MCP server *is* the public surface. Workix
talks to them as a client through [`src/mcpClient.ts`](./src/mcpClient.ts) (JSON-RPC over
streamable HTTP, SSE-aware, session-header aware), the same way the JobSpy bridge talks to
somebody else's scrapers instead of reimplementing them.

| Board | Server | Auth | State |
|-------|--------|------|-------|
| **Dice** | `mcp.dice.com/mcp` | none | ✅ open — 2 574 hits for "python", live apply URLs |
| **Workopia** | `workopia.io/api/mcp-jobs` | free account | 🔑 `tools/list` is anonymous, `tools/call` is not |

**Dice** is worth naming for two fields nothing else here carries: a salary on most cards, and
`willingToSponsor` — visa sponsorship as a filter (`DICE_SPONSOR_ONLY=1`, or
`willing_to_sponsor` per call; 274 of those 2 574 sponsor). Its `posted_date` is a
case-sensitive enum — `ONE`/`THREE`/`SEVEN`, and lowercase gets you a pydantic error rather
than a coercion, so the adapter maps `hours` onto it for you.

**Workopia** aggregates ATS boards (Lever, Greenhouse, Workday, career pages) across 90+
countries — same class of source as our own `ats` adapter, with somebody else's coverage.

There is no API key to paste. The server advertises OAuth 2.0 with **dynamic client
registration and PKCE** as a public client (`token_endpoint_auth_methods_supported: ["none"]`),
so the token has to be earned by running the flow once:

```bash
cd mcp && npm run workopia:login
```

It registers a client, prints an authorize URL, and catches the redirect on `127.0.0.1` — the
password is typed in the browser and never passes through Workix. The grant lands in
`mcp/data/workopia-tokens.json` and refreshes itself afterwards. `WORKOPIA_TOKEN` still works as
an escape hatch if you hold a bearer token from somewhere else.

It also needs a **city** — `job_tool` requires one, and an empty value returns nothing rather
than searching everywhere. Resolved in this order, so most people never set anything:

1. the `city` argument on the call
2. `WORKOPIA_CITY`
3. your `mcp/profile.md` — either an explicit `city: Berlin` line, or the `Гео / язык:` line the
   example profile already ships

A two-letter code is rejected on purpose: `Гео / язык: RU, EN` means a country and a language,
and searching for a city named "RU" returns nonsense, which is worse than skipping with a
message. `Remote` and `Worldwide` are passed through verbatim — Workopia documents no wildcard,
so `*` would be a guess; confirm what it accepts once you are signed in.

Without a token or a city the board skips quietly instead of failing the digest.

Probed and rejected on 2026-08-10, so nobody re-runs it: **Indeed MCP** (Claude-connector only,
no reachable endpoint), **Fantastic.jobs / Career Site Jobs** (`403 Missing Authentication
Token` — RapidAPI/Apify, paid), **hiring.cafe** (`401`), **The Best Job Board** (no working MCP
path). Himalayas, Jobicy, Aquent and AI Dev Jobs do run MCP servers, but we already read their
REST APIs directly, so the bridge would add a hop and nothing else.

**Workable, Workato and WorkflowMAX are not job sources**, despite sitting next to Workopia in
the connector directory. `mcp.workable.com` is the employer side of an ATS — its scopes are
`r_candidates`/`w_candidates`, `r_employees`, `w_timeoff`, `w_reviews`: you connect *your own*
company account to manage hiring, not to search other companies' openings. Workato is an iPaaS
whose MCP server is generated per customer from your own recipes (`{n}.apim.mcp.workato.com`,
`401` without your tenant). WorkflowMAX is a Xero product for trades, where "jobs" are work
orders inside your own account. None of the three exposes anybody else's vacancies.

What Workable *does* give us is the public **ATS** endpoint we already support — see below.

Four more light up as soon as their free key is in `.env` — **USAJOBS**, **SuperJob**,
**Careerjet**, **Jooble**. **JobsPipe** needs a key too but stays out of the automatic digest
because it is metered (see below). Until then they skip silently. Which are on:

```bash
workix_sources_status   # → keyed_boards
```

Check every new source against the live APIs:

```bash
node scripts/smoke-new-sources.mjs
```

### Optional JobSpy bridge — Indeed, LinkedIn, Google Jobs, Glassdoor, ZipRecruiter, Bayt, Naukri, BDjobs

These eight are **opt-in and read-only**. They are not touched by a plain `workix_digest` — you
have to name them: `platforms: ["indeed"]`. Applying from the agent is not possible on any of
them; they link out to an external ATS.

Two of them need a word of warning:

- **Google Jobs** ignores the plain search term. JobSpy pastes `google_search_term` into the
  Google Jobs box verbatim, so phrase the query the way you would type it there —
  `"software engineer jobs near London since yesterday"`, not `"software engineer"`.
- **LinkedIn** is the most rate-limited board here (it throttles around page 10 from one IP) and
  omits the body from search results. `JOBSPY_LINKEDIN_DESCRIPTIONS=1` fetches descriptions at
  the cost of one extra request per card.

A note on proxies: `refreshJobs` hands JobSpy the same pool the rest of the adapters use, but
only the `http://`/`https://` entries. JobSpy drives `requests`, which cannot open a `socks5://`
tunnel without PySocks and fails the whole board with *"Missing dependencies for SOCKS support"*
— worse than no proxy at all, since LinkedIn pulls fine direct. `pip install PySocks` in the
same venv if you want your SOCKS pool used here too.

They are served by one adapter that calls **[JobSpy](https://github.com/speedyapply/JobSpy)**
(MIT) installed on your own machine. We do not vendor its scrapers: the boards are reached
through private endpoints with credentials that ship inside the JobSpy release, and those
belong in your install, not in our package.

#### Install

**Python must be 3.10–3.12.** `python-jobspy` pins `numpy==1.26.3`, which has no wheels for
3.13 — pip falls back to a source build and dies in meson. This is the single most common way
to get stuck.

```bash
python -m venv .jobspy && .jobspy/bin/pip install -U python-jobspy
```

On Windows the interpreter is `.jobspy\Scripts\python.exe`. Already on 3.13? Get a 3.12
without touching your system Python:

```bash
pip install uv && uv python install 3.12
```

Then create the venv with that interpreter and point the MCP at it:

```bash
# .env — full path to the venv's python
PYTHON_BIN=/abs/path/.jobspy/bin/python
```

`PYTHON_BIN` is optional if a suitable `python3`/`python` is already first on `PATH`, but with
a venv you almost always want it set explicitly.

#### Verify

```bash
workix_digest {"platforms":["indeed"],"include_jobs":true,"keywords":["python"]}
```

Not installed → the tool says so and how to fix it, rather than returning an empty list.

#### Or skip the bridge: JobsPipe

[JobsPipe](https://jobspipe.dev/agent) normalizes 39 feeds behind one key — **LinkedIn, Indeed,
Y Combinator, Greenhouse, Lever, Ashby, SmartRecruiters, Workday, Workable, Paylocity** and
more. No Python, no `numpy==1.26.3` pin, and no 403, because the request goes to their server
rather than to the board.

It is **metered: one credit per job returned**, free tier 1000/month. So unlike every other
board it does *not* run on a bare `include_jobs` — that would let a scheduled digest eat the
month unnoticed. Three ways in:

| | |
|--|--|
| `workix_jobspipe_search` | aimed query; reports `spent_this_call` and `remaining_this_month` |
| `platforms: ["jobspipe"]` | pull it inside a digest, once |
| `JOBSPIPE_IN_DIGEST=1` | opt in to every `include_jobs` run |

```bash
workix_jobspipe_usage        # credits left this month
workix_jobspipe_usage {"reset": true}   # plan renewed off-cycle
```

The counter lives in `data/jobspipe-usage.json` and tracks what this MCP spent — it is a guard
rail, not a bill. The adapter refuses to start a call once `JOBSPIPE_MONTHLY_BUDGET` is gone,
and never asks for more rows than the remaining budget.

Filters go well past a title: `companies`, `skills`, `locations`, `countries`, `sources` /
`exclude_sources` (pick or drop individual feeds), `seniority`, `exclude_titles`. Same role from
LinkedIn and from the company's Greenhouse board arrives as two rows — provenance is in
`raw.sources`.

**`workix_company_tech_stack`** wraps their stack scanner (frameworks, CDN, analytics,
payments, with confidence scores). It runs on their MCP endpoint, has no REST route, and costs
**no job credits** — handy for naming a company's real stack in a proposal.

JobsPipe is read-only: `/v1/jobs`, `/v1/jobs/ingest` → 404. It indexes other people's boards
and does not accept postings.

#### When a board returns nothing

Boards block aggressively and JobSpy reports failures by logging and returning an empty
result, not by raising — so the adapter reads its log and tells you which it was. A real
example:

```
glassdoor: jobspy glassdoor (v1.1.82) returned nothing and logged:
Glassdoor: bad response status code: 403
```

That is a block, not an empty search. Usual causes and fixes:

- **Credentials rotated upstream** — the keys live inside the JobSpy release, so a board
  rotating them breaks every JobSpy user at once. Fix: `pip install -U python-jobspy`.
- **Rate limited** — wait, and pass proxies. Every board here throttles; LinkedIn is the
  worst, Indeed the most forgiving.
- **Geo-blocked or location required** — Glassdoor in particular wants a parseable location.

If a board returns nothing and logs nothing at all, the adapter says that too, because an
empty list with no reason is the one answer that tells you nothing. Widen the query first; if a
browser shows results for the same search, it is JobSpy's parser, not you.

#### Live status — 2026-08-10, `python-jobspy` 1.1.82

All eight tested against live traffic from one ordinary datacenter IP, no proxies.
**Indeed and LinkedIn worked.**

| Board | Result | What it is |
|-------|--------|------------|
| **Indeed** | ✅ live jobs | — |
| **LinkedIn** | ✅ 50 live jobs through the digest | descriptions need `JOBSPY_LINKEDIN_DESCRIPTIONS=1` |
| Google Jobs | ❌ 0 rows, no error | HTTP 200 from `/search?udm=8`, parser extracts nothing — **upstream markup drift** |
| Bayt | ❌ 403 | IP-level block; needs an `http://` proxy |
| Glassdoor | ❌ 403 | IP-level block |
| ZipRecruiter | ❌ 403 `forbidden aa` (`CFRAY`) | Cloudflare |
| Naukri | ❌ `ReadTimeout` | unreachable from here, likely geo |
| BDjobs | ❌ `TypeError` in `BDJobs.__init__` | **upstream bug — broken for everyone** |

The blocks depend on where you are calling from and may work over proxies or from another
network. BDjobs and Google Jobs cannot work for anybody until JobSpy fixes them, so treat those
two as unavailable rather than as something you configured wrong.

**Terms:** these boards forbid automated collection. Installing this module is your decision
and running it is your responsibility.

**Rule:** never submit a proposal without explicit user approval.

## Smoke

```bash
npm run smoke
npm run smoke:startups
```

## Dev

```bash
npm run dev
```
