# Workix MCP changelog

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
