# Workix MCP changelog

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
