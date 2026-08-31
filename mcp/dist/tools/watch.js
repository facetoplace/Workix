const SOURCES = {
    profi: {
        name: "Profi.ru",
        open_url: "https://profi.ru/backoffice/",
        kind: "service",
        value: "gigs RU services (auto-collect via include_services)",
        checklist: [
            "Автосбор: workix_collect / workix_digest с include_services:true (или platforms:[\"profi\"]) тянет заказы кабинета в store (kind=service). Логин один раз: scripts/board-open.mjs profi https://profi.ru/backoffice/ + board-save.mjs profi.",
            "Здесь — деталь/контакт: открой карточку заказа в браузере (или залогинься, если сессия протухла).",
            "Для отклика: workix_get_job (url+platform=profi+title) → draft → workix_prepare_browser_apply.",
            "Не отправлять отклик без явного «ок».",
        ],
    },
    avito: {
        name: "Avito Работа",
        open_url: "https://www.avito.ru/all/vakansii",
        kind: "job_board",
        value: "RU вакансии (auto-collect: include_services + AVITO_ENABLE=1)",
        checklist: [
            "Автосбор (ToS — полуручной): workix_collect / workix_digest с include_services:true (или platforms:[\"avito\"]) И env AVITO_ENABLE=1 тянет вакансии в store (kind=job). Логин один раз: scripts/board-open.mjs avito https://www.avito.ru/profile + board-save.mjs avito.",
            "Релевантность: AVITO_URL можно указать на сохранённый поиск (регион / удалёнка / запрос), иначе дефолт /all/vakansii + фильтр по ключевикам.",
            "Здесь — деталь/чат: открой карточку вакансии в браузере.",
            "Для отклика: workix_get_job (url+platform=avito+title) → draft → workix_prepare_browser_apply (чат / отклик).",
            "Не слать массовые шаблоны; не жать Отправить без «ок».",
        ],
    },
    youdo: {
        name: "YouDo",
        open_url: "https://youdo.com/",
        kind: "service",
        value: "RU tasks for doers",
        checklist: [
            "Залогинься в YouDo как исполнитель.",
            "Лента заданий — 5 релевантных со ссылками.",
            "Для отклика: workix_get_job (url+platform=youdo+title) → draft → workix_prepare_browser_apply.",
            "Не отправлять без «ок».",
        ],
    },
    sproutgigs: {
        name: "SproutGigs",
        open_url: "https://sproutgigs.com/",
        kind: "marketplace",
        value: "microtasks / gigs",
        checklist: [
            "Залогинься на sproutgigs.com.",
            "Jobs / available gigs — 5 релевантных со ссылками.",
            "Для отклика: workix_get_job (url+platform=sproutgigs+title) → draft → workix_prepare_browser_apply.",
            "Не жать Apply/Submit без явного «ок».",
        ],
    },
    product_radar: {
        name: "Product Radar",
        open_url: "https://productradar.ru/category/hiring",
        kind: "job_board",
        value: "RU hiring HTML → workix_search (pages 1–3)",
        checklist: [
            "Лента уже в digest/search (platform=product_radar).",
            "Для деталей/контакта: browser → карточка /product/…",
            "Пагинация на сайте: /category/hiring/?page=2 …",
        ],
    },
    startupfellows: {
        name: "StartupFellows",
        open_url: "https://startupfellows.ru/vacancies",
        kind: "watch",
        value: "RU startup roles (watch only — не в workix_search)",
        checklist: [
            "Вакансии /vacancies; поиск по Flutter/mobile.",
            "remote / part-time / founding-adjacent — 5 пунктов.",
            "Capture: workix_get_job(url+platform=startupfellows+title) → draft → TG/browser.",
        ],
    },
    yc_cofounder: {
        name: "YC Co-Founder Matching",
        open_url: "https://www.ycombinator.com/cofounder-matching",
        kind: "cofounder",
        value: "best-in-class cofounder matching",
        checklist: [
            "Нужен approved профиль YC matching.",
            "Просмотри matches / invites за период.",
            "Выпиши 3–5 потенциальных кофаундеров (skills, location, idea).",
            "Не слать шаблонный спам — персональный note.",
        ],
    },
    cofounderslab: {
        name: "CoFoundersLab",
        open_url: "https://cofounderslab.com/",
        kind: "cofounder",
        value: "large cofounder network",
        checklist: [
            "Поиск technical cofounder / mobile.",
            "Учти лимиты поиска на free tier.",
            "5 профилей в сводку.",
        ],
    },
    wellfound: {
        name: "Wellfound",
        open_url: "https://wellfound.com/jobs",
        kind: "startup_jobs",
        value: "global startup roles",
        checklist: [
            "Логин в browser; API-ключа нет.",
            "Если Cloudflare / «Access is temporarily restricted» — не долбить: skip → BotPool/Radar (часто даже после login).",
            "Иначе фильтры: remote, engineering, contract.",
            "5 ролей с apply URL.",
        ],
    },
    contra: {
        name: "Contra",
        open_url: "https://contra.com/jobs",
        kind: "marketplace",
        value: "0% fee gigs (Pro for full feed)",
        checklist: [
            "Логин в browser; ключ API не нужен.",
            "Free: часто 1 карточка; полный каталог (~200+) — Contra Pro. Без Pro не ждать ленту.",
            "Если Pro есть: jobs под mobile, AI, product → 5 карточек + ссылки.",
            "Без Pro — skip / другая площадка (Wellfound, BotPool).",
        ],
    },
    fiverr: {
        name: "Fiverr",
        open_url: "https://www.fiverr.com/start_selling",
        kind: "marketplace",
        value: "Briefs (inbound match) / Custom Offer — no public job board",
        checklist: [
            "Логин в Cursor browser. Ключ API не нужен; cookies не в .env.",
            "Гейт onboarding: /seller_onboarding/overview → профиль, потом ≥1 Gig (черновик→Publish) + Get Briefs (min rate).",
            "Верификация (без неё seller «not visible» / Catalog): (1) phone — обязателен для freelancer / Gig create; (2) personal & business info (DSA); (3) ID upload через Persona. Talent Dashboard → Complete verification. Help: phone + identity-as-new-freelancer.",
            "Help: задача ID иногда «locked until first Gig publish»; на зонде 2026-08 wizard ID открылся до Publish. US sellers: Form W-9; non-US — свой tax flow.",
            "Buyer Requests сняты. Лента seller = Briefs → Your matches (или Inbox/email). Browse чужих брифов нельзя; /briefs/manage = buyer UI («Post a brief»), не заказы.",
            "На match: Creating an offer / Ask questions / Not interested (~72h). Или Custom Offer из Inbox.",
            "Capture: workix_get_job url+platform=fiverr+title(+description) → draft → workix_prepare_browser_apply. Не жать Send/Create Offer / Publish без «ок».",
            "Session sniff (не wire в digest): GET /briefs/manage/api/list, GET /inbox/contacts; GraphQL /graphql часто 403.",
        ],
    },
    botpool: {
        name: "BotPool",
        open_url: "https://www.botpool.ai/portal/developer/home",
        kind: "marketplace",
        value: "AI/bots freelance",
        checklist: [
            "Логин developer portal; API-ключа нет.",
            "Профиль ≠ apply: Stripe (+ Payoneer) обязательны — View Now disabled. Workix: skip apply, не просить привязать payout.",
            "Лента видна без payout — максимум 5 заголовков в сводку; отклик только если юзер сам подключил Stripe.",
        ],
    },
    arc_dev: {
        name: "Arc.dev",
        open_url: "https://arc.dev/",
        kind: "vetted",
        value: "vetted remote matching",
        checklist: [
            "Кабинет / job matches (нужен vetted профиль).",
            "Новые матчи за период — в сводку.",
        ],
    },
    habr_career: {
        name: "Habr Career",
        open_url: "https://career.habr.com/vacancies?remote=true",
        kind: "job_board",
        value: "RU IT remote",
        checklist: [
            "Лента remote уже в workix_digest / search при include_jobs: true (RSS).",
            "Здесь — UI: Remote / гибкая занятость, детали карточек.",
            "5 вакансий; отметь project/part если видно.",
        ],
    },
    linkedin_jobs: {
        name: "LinkedIn Jobs / topics",
        open_url: "https://www.linkedin.com/jobs/search/?keywords=mobile%20OR%20cofounder&f_WT=2",
        kind: "watch",
        value: "jobs + cofounder signals",
        checklist: [
            "Только полуручной режим (ToS).",
            "Jobs: Remote + Contract.",
            "Дополнительно поиск постов #hiring #cofounder.",
            "5 лидов со ссылками — без массового Easy Apply.",
        ],
    },
    feltsense: {
        name: "Feltsense",
        open_url: "https://feltsense.com",
        kind: "watch_low",
        value: "agentic founders / careers",
        checklist: [
            "Не маркетплейс — смотри Careers / «humans at the edges».",
            "Если есть hiring — 1–3 пункта, иначе skip.",
        ],
    },
    magier: {
        name: "Magier",
        open_url: "https://www.magier.com/",
        kind: "watch_low",
        value: "design network / not open board",
        checklist: [
            "Проверь careers / join talent, не публичную ленту заказов.",
            "Имеет смысл только если цель — войти в их пул.",
        ],
    },
    ph_hiring: {
        name: "Product Hunt Hiring",
        open_url: "https://www.producthunt.com/discussions",
        kind: "watch",
        value: "startup roles threads",
        checklist: [
            "Тред Hiring / Looking for work.",
            "5 стартапов/ролей.",
        ],
    },
    telegram_watch: {
        name: "Telegram channels (list)",
        open_url: "https://web.telegram.org/",
        kind: "telegram",
        value: "RU gigs + startup channels",
        checklist: [
            "Предпочтительно: optional TDLib — workix_tg_status → auth → workix_tg_search (BYO api_id/hash).",
            "Иначе browser: открой каналы из mcp/telegram-channels.json (или example).",
            "За последние 24–48ч выпиши заказы/вакансии под mobile/bots/startup.",
            "5 пунктов со ссылками на посты. Не спамить в чаты.",
        ],
    },
};
export async function runOpenWatchSource(args) {
    const s = SOURCES[args.source];
    if (!s) {
        return {
            error: `Неизвестный source. Доступно: ${Object.keys(SOURCES).join(", ")}`,
        };
    }
    return {
        source: args.source,
        name: s.name,
        open_url: s.open_url,
        kind: s.kind,
        value_hint: s.value,
        hard_rules: [
            "НЕ отправлять отклики/инвайты без явного «ок» пользователя.",
            "LinkedIn/YC — без массового автоспама.",
        ],
        checklist_for_agent: [
            `1. browser_navigate → ${s.open_url}`,
            "2. browser_snapshot",
            ...s.checklist.map((c, i) => `${i + 3}. ${c}`),
        ],
    };
}
export function listWatchSources() {
    return Object.entries(SOURCES).map(([id, s]) => ({
        id,
        name: s.name,
        open_url: s.open_url,
        kind: s.kind,
        value: s.value,
    }));
}
export const WATCH_SOURCE_IDS = Object.keys(SOURCES);
