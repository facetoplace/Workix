# Контрибут в Workix

Хотим, чтобы **сообщества и проекты** допиливали Workix вместе с нами — в первую очередь **MCP** (адаптеры, tools, пресеты) и **витрину**.

Канон docs сейчас: [English](CONTRIBUTING.md) · [Русский](CONTRIBUTING.ru.md).

## Что здесь

| Зона | Path | Хорошие первые PR |
|------|------|-------------------|
| **MCP** | `mcp/` | Адаптер биржи, digest/search, пресеты, docs, тесты |
| **Витрина** | `views/`, `assets/` | UX, a11y, i18n, empty states |
| **Self-host** | `docker/` | Рецепты деплоя, CNAME |
| **Docs** | `README*.md`, `docs/` | Переводы после согласования EN/RU |

**Данные** каталога и модерация — на центральном хабе ([workix.co](https://workix.co)). БД хаба в этот репо **не** входит.

## MCP — вместе с сообществом

1. **Tools хаба** — `https://workix.co` + ключ `wix_…` (проекты, роли, профиль, feedback).
2. **Адаптеры бирж** — digest/search/draft с **локальными** кредами.

### Добавить или улучшить адаптер

1. Fork → clone → `cd mcp && npm i && npm run build`
2. Площадка в [`mcp/platforms.json`](mcp/platforms.json).
3. Код в `mcp/src/adapters/<id>.ts` (ориентиры: `rss.ts`, `freelancehunt.ts`, `upwork.ts`).
4. При необходимости — tools в `mcp/src/index.ts` / `mcp/src/tools/*`.
5. Env в `mcp/.env.example` + заметка в `mcp/README.md`.
6. В PR — **моки**; не коммитить токены и дампы `mcp/data/*`.

### Правила безопасности

- Пароли/OAuth секреты площадок — не в git.
- `workix_submit_proposal` только с `confirm: true` после явного «ок» человека.
- Запись в хаб — с учётом модерации и форматов из [api.txt](https://workix.co/api.txt).
- Не грузить креды бирж на хаб.

## Витрина

- Для зеркал `workix-api` → `https://workix.co`.
- При правках JS/CSS — бамп `?v=` в HTML.
- Формулировки про «центральный хаб API», без private-инфры.

## Как предложить работу

1. [Issue](https://github.com/facetoplace/Workix/issues) — баг, адаптер, «хотим фичер с нашего домена».
2. Маленькие PR лучше огромных.
3. Напишите, чем воспроизвести.

Проекты с зеркалом на `work.yourdomain.com` — присылайте фиксы featuring/embed upstream.

## Лицензия

Менять и распространять можно с указанием авторства. Коммерческое переиспользование — по согласованию. Подробности: [LICENSE](LICENSE).

## Вопросы

- Продукт / API: [workix.co/support](https://workix.co/support)
- Агенты: [workix.co/agent](https://workix.co/agent)
- Коммерческое использование: [workix.co/support](https://workix.co/support)
