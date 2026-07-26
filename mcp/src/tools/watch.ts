const SOURCES: Record<
  string,
  {
    name: string;
    open_url: string;
    kind: string;
    value: string;
    checklist: string[];
  }
> = {
  profi: {
    name: "Profi.ru",
    open_url: "https://profi.ru/cabinet/",
    kind: "service",
    value: "gigs RU services",
    checklist: [
      "Залогинься в Profi.",
      "Новые заказы / отклики — 5 релевантных IT/продукт.",
      "Не отправлять без «ок».",
    ],
  },
  product_radar: {
    name: "Product Radar",
    open_url: "https://productradar.ru/category/hiring",
    kind: "watch",
    value: "RU products + hiring",
    checklist: [
      "Hiring + свежие продукты на Radar.",
      "5 ролей/продуктов под мобилки/стартап.",
    ],
  },
  startupfellows: {
    name: "StartupFellows",
    open_url: "https://startupfellows.ru/vacancies",
    kind: "watch",
    value: "RU startup roles",
    checklist: [
      "Вакансии StartupFellows.",
      "remote / part-time / founding-adjacent — 5 пунктов.",
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
      "Фильтры: remote, engineering, contract если есть.",
      "5 ролей с apply URL.",
    ],
  },
  contra: {
    name: "Contra",
    open_url: "https://contra.com/opportunities",
    kind: "marketplace",
    value: "0% fee gigs",
    checklist: [
      "Opportunities / projects под mobile, AI, product.",
      "5 карточек + ссылки.",
    ],
  },
  botpool: {
    name: "BotPool",
    open_url: "https://www.botpool.ai/",
    kind: "marketplace",
    value: "AI/bots freelance",
    checklist: [
      "Find Jobs / AI Development категории.",
      "5 проектов под боты/агенты/автоматизацию.",
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
      "Remote / гибкая занятость.",
      "5 вакансий; отметь project/part если видно.",
    ],
  },
  linkedin_jobs: {
    name: "LinkedIn Jobs / topics",
    open_url:
      "https://www.linkedin.com/jobs/search/?keywords=mobile%20OR%20cofounder&f_WT=2",
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
      "Открой каналы из mcp/telegram-channels.json (или example).",
      "За последние 24–48ч выпиши заказы/вакансии под mobile/bots/startup.",
      "5 пунктов со ссылками на посты.",
    ],
  },
};

export async function runOpenWatchSource(args: {
  source: string;
}): Promise<unknown> {
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

export function listWatchSources(): unknown {
  return Object.entries(SOURCES).map(([id, s]) => ({
    id,
    name: s.name,
    open_url: s.open_url,
    kind: s.kind,
    value: s.value,
  }));
}

export const WATCH_SOURCE_IDS = Object.keys(SOURCES) as [
  string,
  ...string[],
];
