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

## Downloadable platform modules

Core MCP always includes hub tools + **RSS** (FL / Weblancer), Freelance.ru HTML (`/task` via RU SOCKS5), and Product Radar hiring HTML (`/category/hiring/?page=N`, direct).

Other boards ship as modules from the hub:

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

## Install

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
| `workix_checkpoint_set` / `workix_checkpoint_get` | Search pause/resume: where stopped, next, surfaces. Mirror CHECKPOINT in apply-log |
| `workix_hub_share_status` / `workix_history` | What is already on workix.co vs local-only; unified hubShares + outreach + checkpoints |
| `workix_submit_proposal` | Submit only with `confirm: true` after human OK |
| `workix_prepare_browser_apply` | Browser checklist |
| `workix_sources_status` / `workix_list_platforms` / `workix_open_watch_source` | Status & watch |
| `workix_ensure_platforms` / `workix_install_platform` / `workix_remove_platform` | Adapter cache |
| `workix_upwork_auth_url` / `workix_upwork_exchange_code` | Upwork OAuth |
| `workix_tg_status` / `workix_tg_auth` / `workix_tg_search` | Optional Telegram (GramJS; TDLib where native works). Install: `npm install telegram`. Env: `TG_APP_API_ID` + `TG_APP_API_HASH`. Login: `npm run tg:login`. |

### Optional Telegram

Полная инструкция: **[TELEGRAM.md](./TELEGRAM.md)**. На **Windows ARM64** — только GramJS (`telegram`), не `prebuilt-tdlib`.

```bash
cd mcp
npm install telegram
# TG_APP_API_ID + TG_APP_API_HASH in .env
npm run tg:login          # phone/code в терминале
# restart MCP → workix_tg_status → workix_tg_search
```

### Optional JobSpy bridge — Indeed, Glassdoor, ZipRecruiter, Naukri, BDjobs

These five are **opt-in and read-only**. They are not touched by a plain `workix_digest` — you
have to name them: `platforms: ["indeed"]`. Applying from the agent is not possible on any of
them; they link out to an external ATS.

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

#### Live status — 2026-08-09, `python-jobspy` 1.1.82

All five tested against live traffic from one ordinary IP. **Only Indeed worked.**

| Board | Result | What it is |
|-------|--------|------------|
| **Indeed** | ✅ 20 live jobs | — |
| Glassdoor | ❌ 403 | IP-level block |
| ZipRecruiter | ❌ 403 `forbidden aa` (`CFRAY`) | Cloudflare |
| Naukri | ❌ `ReadTimeout` | unreachable from here, likely geo |
| BDjobs | ❌ `TypeError` in `BDJobs.__init__` | **upstream bug — broken for everyone** |

The three blocks depend on where you are calling from and may work over proxies or from
another network. BDjobs cannot work for anybody until JobSpy fixes it, so treat it as
unavailable rather than as something you configured wrong.

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
