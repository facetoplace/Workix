---
name: workix-orders
description: >-
  Searches freelance orders via Workix MCP (FL, Freelance.ru, Weblancer, Kwork,
  Freelancehunt, Upwork OAuth GraphQL), HH remote/project jobs, Remote OK, and
  watch sources (Profi, Product Radar, StartupFellows, YC, Wellfound, Contra,
  BotPool, LinkedIn, Telegram). Drafts proposals and prepares browser apply.
  Use for digests, mobile_dev/startups_products presets, or отклик.
---

# Workix Orders

## Flows

| Запрос | Действие |
|--------|----------|
| что нового / биржи | `workix_digest` (или `preset: mobile_dev`) |
| мобилки / приложения | `workix_digest` preset `mobile_dev` |
| VPN / WireGuard / EN mobile | `workix_digest` preset `vpn_mobile` (Upwork+Freelancer.com) |
| стартапы / продукты | `workix_digest` preset `startups_products` + watch list |
| удалёнка HH / проекты | `workix_digest` `include_jobs: true` |
| кофаундер | `workix_open_watch_source` `yc_cofounder` / `cofounderslab` |
| Wellfound / Contra / BotPool | `workix_open_watch_source` с id площадки |
| LinkedIn / TG | `linkedin_jobs` / `telegram_watch` (полуручной) |
| Upwork OAuth | `workix_upwork_auth_url` → code → `workix_upwork_exchange_code` |
| список площадок | `workix_list_platforms` |
| баг / предложение / support | `workix_feedback` (`type`: bug\|suggestion\|support\|other) |
| отклик | get_job → draft → показать → save → submit/prepare_browser |

Сначала при сбоях: `workix_sources_status` (PROXY_1 + Upwork/FH токены).

Каталог площадок: `workix_list_platforms` / `mcp/platforms.json`.  
Адаптеры бирж **докачиваются** с хаба (`workix.co/mcp/registry.json`) при первом digest/search или через `workix_ensure_platforms` / `workix_install_platform`; кэш в `mcp/data/adapters/`. RSS (FL/Freelance.ru/Weblancer) — в ядре.  
Контрибут: `CONTRIBUTING.md` / `mcp/README.md` (`npm run pack:adapters`).

## Hard rules

- Never Submit/Отправить without explicit user «ок».
- `workix_submit_proposal` only with `confirm: true` after approval.
- LinkedIn / YC — без массового автоспама; только checklist + сводка.
- Profi = browser only (no partner mTLS).
