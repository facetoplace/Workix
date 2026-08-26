# Telegram в Workix MCP (optional)

Локальный user-client: поиск по чатам/каналам.  
**Креды и сессия Telegram никогда не уходят на workix.co.**

## Два режима `workix_tg_search`

- **`mode: "search"` (по умолчанию)** — серверный поиск: по каждому термину отдельный проход `messages.search` по каналам, merge. Сильно для **глубокой истории одного редкого слова** (`libxray`, `hysteria`). Дорого при большом наборе слов, слабая морфология RU.
- **`mode: "dump"`** — свип свежей истории каждого канала (пустой `search`) в базу, затем **локальный матч по всему корпусу**: сильно для **широкого изменяемого набора слов и свежести**. Окно задаётся явно (`days`, по умолчанию 30) — не из чекпоинта. Матчинг: слова по границе (`ton` ≠ `button`), отсев резюме, схлопывание кросс-постов, флаги `applied` / `cross_posts`, параметр `hide_applied`.

`since` для `search` берётся только из **Telegram-чекпоинта** (не из любого) и с полом в 2 дня — свежий служебный чекпоинт больше не занулит окно.

---

Бэкенд:
- **GramJS** (`telegram`) — по умолчанию, работает на **Windows ARM64**
- TDLib (`tdl` + `prebuilt-tdlib`) — только если native поддерживается (не win-arm64)

Каталог каналов (публичный, PRs): [`TELEGRAM-CHANNELS.md`](./TELEGRAM-CHANNELS.md) + [`telegram-channels.example.json`](./telegram-channels.example.json).  
Внутренние заметки (сервер): [docs/15-telegram-channels.md](../docs/15-telegram-channels.md).

---

## Что куда класть (безопасность)

| Данные | Куда | В чат Cursor? |
|--------|------|----------------|
| `TG_APP_API_ID` / `TG_APP_API_HASH` (или `TELEGRAM_API_*`) | repo `.env` или `mcp/.env` | api_id можно; hash лучше не светить |
| Телефон / код SMS / 2FA | **только терминал** `npm run tg:login` | **нет** |
| Сессия | `mcp/data/telegram/gramjs.session` | нет |

---

## Быстрый старт (Windows ARM64 и все остальные)

```bash
cd mcp
npm install telegram
# TG_APP_API_ID + TG_APP_API_HASH уже в .env
cp telegram-channels.example.json telegram-channels.json   # если ещё нет
npm run tg:login
```

**Код чаще приходит в приложение Telegram** (чат с аккаунтом «Telegram»), а не SMS.  
Если SMS нет — открой Telegram на телефоне с этим номером.

Альтернативы:
```bash
npm run tg:login -- --qr    # QR: Settings → Devices → Link Desktop Device (без SMS)
npm run tg:login -- --sms   # попросить SMS (если Telegram даст)
```

Если 2FA и вставка пароля в окне не работает — временно в `.env`:
```env
TELEGRAM_2FA_PASSWORD=your_cloud_password
```
Потом снова `npm run tg:login -- --qr`, после `OK` **удали** эту строку из `.env`.

Успех: `OK — logged in as … [GramJS]`.  
Перезапусти Workix MCP → `workix_tg_status` → `workix_tg_search`.

---

## Агенту

> `npm install telegram` в `mcp/`, затем `npm run tg:login` и **жди** — телефон/код ввожу сам в терминале. Не проси SMS/2FA в чат. После OK — рестарт MCP, `workix_tg_status` / `workix_tg_search`.

---

## Troubleshooting

| Симптом | Что сделать |
|---------|-------------|
| `win32-arm64 is not supported` | это старый TDLib — ставь `telegram` (GramJS), не `prebuilt-tdlib` |
| `missing_deps` | `cd mcp && npm install telegram` |
| `missing_credentials` | `TG_APP_API_*` в `.env` |
| `wait_phone` | снова `npm run tg:login` |
| Бан / flood | не спамь; правила чатов |
| `total: 0` по всем чатам | поиск Telegram — подстрока, `OR` он не понимает. `workix_tg_search` теперь сам режет `a OR b` (и списки через запятую) на отдельные поиски: смотри `terms_searched` в ответе — если там 1, а слов было несколько, запрос ушёл как есть |
| обошло не все каналы | по умолчанию берутся первые 20 из `telegram-channels.json` (`chats_available` / `chats_skipped` в ответе). Больше — `max_chats`, но каждый терм это полный проход по каждому чату |

Сброс сессии: удали `mcp/data/telegram/`, снова `npm run tg:login`.
