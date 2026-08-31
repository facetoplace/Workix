# Workix MCP changelog

## 1.2.6 — 2026-08-31

First public release since 1.2.2 — ships 1.2.3 → 1.2.6 to the public repo in one release.

### Added

- **Agent-community sources in the catalog** ([`platforms.json`](./platforms.json)) — The Colony, Agent Community, Moltbook, Chirper.ai, SocialAIA and 0xWork added for networking/discovery, alongside the X (Twitter) and Avito Работа entries.
- **`workix_bump_profile`** ([`src/index.ts`](./src/index.ts)) — tool implementation landed: resurface the participant card to the top of the catalog without an edit. One bump / 3 days, the hub returns a cooldown with the next allowed time (any `workix_update_profile` edit already bumps the card).

### Improved

- Expanded onboarding / session-flow guidance (participant-card recommendation, no-key join path via `workix_hub_register` or `workix.co/auth`, and the end-of-session share-best gate) and hub schema/tool refinements.

### Packaging

- Version bumped `1.2.5` → `1.2.6`. Bundles the 1.2.3 (session-flow guidance), 1.2.4 (Profi.ru + Avito) and 1.2.5 (X leads) work for the public repo.

## 1.2.5 — 2026-08-31

### Added — X (Twitter) leads

- **X (Twitter)** ([`src/adapters/x.ts`](./src/adapters/x.ts)) — hiring tweets and founder/co-founder posts as `kind: "lead"`, on the same `withProfilePage` browser-profile path as Wellfound/YC/Avito. Reads `x.com/search?f=live` from the logged-in `x` profile (headful), emits leads, and never applies — DM/ответ остаётся ручным в браузере.
- **Two default lanes** — `hiring` (`#hiring` / «we're hiring» + developer/engineer/remote) and `founder` (cofounder / technical cofounder + looking/seeking/building), merged and deduped by permalink. Anchored on `data-testid="tweet"` + the `/status/` href, so hashed classes churning does not break it. Local keyword filter over tweet text + handle.
- **Opt-in only + double-gated** for X's ToS (automated collection forbidden): runs solely when named `platforms: ["x"]` **and** `X_ENABLE=1`; never on a bare `include_jobs`. `X_QUERIES` overrides the lane set (`'<label>::<query>'`, `;`-separated), `X_QUERY` is single-lane shorthand, `X_URL` pins one search page.
- Log in once with `scripts/board-open.mjs x https://x.com/home` + `board-save.mjs x` (same flow as `avito`/`profi`). Verified 2026-08-31: 18 live leads across both lanes, clean handle/text/permalink parse.

## 1.2.4 — 2026-08-30

### Added — RU browser-profile adapters (Profi.ru, Avito Работа)

- **Profi.ru** ([`src/adapters/profi.ts`](./src/adapters/profi.ts), заказы услуг → `kind: "service"`) and **Avito Работа** ([`src/adapters/avito.ts`](./src/adapters/avito.ts), вакансии → `kind: "job"`) move from watch-only to real browser-profile ingest, on the same `withProfilePage` path as Wellfound/YC. Both read the logged-in feed and never apply — отклик/чат остаётся ручным (`get_job` → draft → browser apply). Verified on live sessions 2026-08-31 (Profi: h3 title + ₽ price + canonical `?o=` link; Avito: `item-title`/`item-price` + canonical `/vakansii/…` link).
- **Opt-in only.** Pulled when named in `platforms` or via the new `include_services` flag on `workix_collect` / `workix_digest`; never on a bare `include_jobs`. `include_services` still renders the semi-manual watch checklist alongside the collected cards.
- **Avito is double-gated** for its ToS (restricts automated collection): runs only when named/`include_services` **and** `AVITO_ENABLE=1`, headful (Avito challenges headless), anchored on `data-marker="item"` + `item-title`/`item-price`. `AVITO_URL` overrides the feed (default `/all/vakansii`) — point it at a saved region/remote/query search.
- **Profi** reads `/backoffice/` via the persistent `profi` profile; `PROFI_URL` overrides the feed page. Log in once with `scripts/board-open.mjs profi … + board-save.mjs profi` (same for `avito`).

## 1.2.3 — 2026-08-29

### Added — session flow guidance

- **Onboarding gate before search** — ensure the person is registered and has a Workix participant profile (offer to build it from a CV / LinkedIn / other profile) before launching a search.
- **Fresh-version check** — compare the local `mcp/package.json` against the latest published on GitHub and offer to update before searching.
- **Contribute-back** — detect local changes/extensions to `mcp/` and offer to open an issue or PR upstream (the free-use condition).
- **Share best** — at the end of a search session, mirror the 3 best finds to the Workix hub before the final summary (the free-use condition).

## 1.2.2 — 2026-08-26

### Improved

- Reframed the public hub vocabulary from **performers** to **participants**, covering networking, collaboration, and mentor discovery by skills and interests. API tool names, routes, and legacy URLs keep `performer` for compatibility.
- Updated MCP guidance and public documentation to describe participant cards, collaboration preferences, and connections between founders, specialists, collaborators, and mentors.

## 1.2.0 — 2026-08-25

### Added — collect → search split

- **`workix_collect`** — phase 1: ingest every source into the store, ranking nothing. HTTP/RSS/boards/HH (via `refreshJobs`, `skip_telegram`) and a full Telegram channel sweep (`sweepTelegramChannels`) run in **parallel**; everything is upserted.
- **`workix_db_search`** — phase 2: rank/filter what's already in the store across **all platforms**, no network. Shared matcher in [`src/searchCorpus.ts`](./src/searchCorpus.ts): word-boundary keyword match (so `ton` ≠ `button`), résumé/"for hire" drop, cross-post collapse, per-advertiser cap (talent-pool floods like Lemon.io), and an "already applied" cross-check against the outreach log (by url, or a corpus-rare company/product name).

### Added — Telegram two modes

- `workix_tg_search` gains **`mode: "search" | "dump"`**. `search` (default) is the server-side per-term walk (deep history of one term); `dump` sweeps each channel's recent history once (empty search) into the store, then matches the whole corpus locally (broad, changing keyword set + freshness), with `applied`/`cross_posts` flags and `hide_applied`.
- Fixed `telegramSearchSince`: `since` is now taken only from a **Telegram** checkpoint (never a generic session checkpoint), floored to 2 days — a just-written checkpoint can no longer shrink the window to zero.

### Added — new sources

- **web3.career** (`web3career`), **reactjobs.io** (`reactjobs`, React/RN/Flutter/mobile), **aijobs.net** (`aijobs`, AI/ML) adapters — server-rendered HTML, no key.
- VC-portfolio boards enabled by default: `accel_jobs`, `sequoia_jobs`, `capitalg_jobs`, `index_startup_jobs`, `generalcatalyst_jobs` (generic parse — getro/consider SPA cards may be partial).
- **Employer ATS** company list expanded (+17): Proton, Tailscale (VPN/networking); Sierra, Cognition, Decagon, Dust, ElevenLabs, Perplexity, Replit, Runway, Writer (AI agents); RevenueCat, Zed, Warp, Modal, Baseten, Granola (mobile/dev-tools/infra). See [`ats-companies.json`](./ats-companies.json).
- **YC Work at a Startup** and **Wellfound** now read through a persistent, logged-in **browser profile** ([`src/browserFetch.ts`](./src/browserFetch.ts) + [`adapters/yc.ts`](./src/adapters/yc.ts), [`adapters/wellfound.ts`](./src/adapters/wellfound.ts)). Log in once with [`scripts/board-open.mjs`](./scripts/board-open.mjs) + [`scripts/board-save.mjs`](./scripts/board-save.mjs). YC runs headless on the saved session; Wellfound is Cloudflare-gated so its adapter launches a real (minimized) Chrome.

### Improved

- Telegram channel list synced between `telegram-channels.json` (local) and `telegram-channels.example.json` (public) — 80 channels, dead ones pruned.

### Packaging

- Version bumped `1.1.0` → `1.2.0`. New adapter `web3career` packed into the registry.

## 1.1.0 — 2026-08-21

### Added

- New adapters: JobSearchDB, regional boards, Remocate, Startup Jobs MCP, Startupium, and TheHub.
- New startup/job discovery tools and runtime source metadata.
- Telegram incremental-search checkpoints, scan timing, source-quality scoring, and channel rotation helpers.
- Source-access and runtime-platform documentation covering public access, authentication, automation limits, and risk levels.

### Improved

- Expanded platform catalog and job collection pipeline.
- More resilient Telegram backends and search state handling.
- Rebuilt `dist/` output and downloadable adapter bundles for public clone-and-run use.

### Packaging

- Version bumped from `1.0.0` to `1.1.0`.
- Public sync excludes local scratch files, credentials, sessions, and personal source lists.
