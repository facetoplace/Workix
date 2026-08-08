/**
 * Public cases + partner channels for the hub SPA.
 * Edit this file to add real stories as they come in.
 */
(function (global) {
  const CASES = [
    {
      id: 'host-featuring',
      titleEn: 'Domain pin: open Workix from your project site',
      titleRu: 'Пин с домена: Workix с сайта проекта',
      summaryEn: 'Teams opening Workix from their own domain see matching roles pinned at the top — same mechanic as the legacy advice box.',
      summaryRu: 'Если открыть Workix с домена проекта, подходящие роли поднимаются вверх — как advice box в legacy.',
      outcomeEn: 'Higher relevance for visitors who already care about that product.',
      outcomeRu: 'Выше релевантность для людей, которые уже пришли «из» продукта.',
      link: 'https://workix.co',
      tags: ['featuring', 'embed'],
    },
    {
      id: 'agent-publish',
      titleEn: 'Publish a project card with an agent key',
      titleRu: 'Карточка проекта через agent key',
      summaryEn: 'With a wix_… key an agent can create a startup and role via MCP/REST without opening the UI.',
      summaryRu: 'С ключом wix_… агент создаёт проект и роль через MCP/REST без UI.',
      outcomeEn: 'Founders keep workflow inside Cursor / Claude while the hub stays the catalog.',
      outcomeRu: 'Фаундер остаётся в Cursor/Claude, а каталог живёт на хабе.',
      link: 'https://workix.co/agent',
      tags: ['agent', 'mcp'],
    },
    {
      id: 'share-go',
      titleEn: 'Share workix.co/{slug} instead of “please register”',
      titleRu: 'Ссылка workix.co/{slug} вместо «зарегистрируйтесь»',
      summaryEn: 'Outreach works better when the founder already has a ready card and a one-click share URL.',
      summaryRu: 'Outreach конвертит лучше, когда у фаундера уже есть готовая карточка и ссылка.',
      outcomeEn: 'Candidates land on the project card (legacy /go/… still works as fallback).',
      outcomeRu: 'Кандидат попадает на карточку проекта (старый /go/… остаётся фолбеком).',
      link: 'https://workix.co/',
      tags: ['share', 'outreach'],
    },
  ];

  const PARTNERS = [
    {
      id: 'news',
      titleEn: 'Workix News',
      titleRu: 'Workix News',
      blurbEn: 'Product updates and open roles digest.',
      blurbRu: 'Обновления продукта и дайджест открытых ролей.',
      href: 'https://t.me/workix_news',
      kind: 'channel',
    },
    {
      id: 'rss-tasks',
      titleEn: 'RSS — Orders',
      titleRu: 'RSS — Заказы',
      blurbEn: 'Native orders feed for bots and partner digests.',
      blurbRu: 'Лента нативных заказов для ботов и партнёрских дайджестов.',
      href: '/feed/tasks.xml',
      kind: 'rss',
    },
    {
      id: 'rss-projects',
      titleEn: 'RSS — Projects',
      titleRu: 'RSS — Проекты',
      blurbEn: 'Approved project cards on the hub.',
      blurbRu: 'Одобренные карточки проектов на хабе.',
      href: '/feed/projects.xml',
      kind: 'rss',
    },
    {
      id: 'liber',
      titleEn: 'Sponsor via Liber',
      titleRu: 'Спонсорство через Liber',
      blurbEn: 'Support the hub if the model fits your community.',
      blurbRu: 'Поддержите хаб, если модель подходит вашему комьюнити.',
      href: 'https://liber.ws/workix',
      kind: 'sponsor',
    },
    {
      id: 'support',
      titleEn: 'Partnership inbox',
      titleRu: 'Партнёрства — написать',
      blurbEn: 'Channels, Radar listings, embeds on your domain — talk to us.',
      blurbRu: 'Каналы, листинги Radar, витрина на вашем домене — напишите нам.',
      href: '/support',
      kind: 'contact',
    },
  ];

  global.WorkixStories = { CASES, PARTNERS };
})(typeof window !== 'undefined' ? window : globalThis);
