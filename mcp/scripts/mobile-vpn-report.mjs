#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = (...p) => pathToFileURL(join(root, "dist", ...p)).href;

const { loadEnv } = await import(dist("env.js"));
const { fetchText } = await import(dist("http.js"));
loadEnv();

async function parseFlRss(url) {
  const res = await fetchText(url, { maxProxies: 8 });
  if (!res.ok) return { error: String(res.error || res.status), items: [] };
  const items = [];
  for (const b of res.text.split("<item>").slice(1)) {
    const title = (
      b.match(/<title><!\[CDATA\[(.*?)\]\]>/) ||
      b.match(/<title>(.*?)<\/title>/) ||
      []
    )[1];
    const link = (b.match(/<link>(.*?)<\/link>/) || [])[1];
    const desc = (
      b.match(/<description><!\[CDATA\[(.*?)\]\]>/s) ||
      b.match(/<description>(.*?)<\/description>/s) ||
      []
    )[1];
    const date = (b.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1];
    if (!title || !link) continue;
    const plain = String(desc || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const budget =
      (title.match(/Бюджет:\s*([^,)]+)/i) || [])[1]?.trim() || null;
    items.push({
      platform: "fl_ru",
      title: title.trim(),
      link: link.trim(),
      description: plain.slice(0, 500),
      date,
      budget,
    });
  }
  return { items, viaProxy: res.viaProxy };
}

async function rokTag(tag) {
  const r = await fetch(`https://remoteok.com/api?tags=${tag}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "WorkixReport/1.0 (workix.co)",
    },
  });
  const data = await r.json();
  return (Array.isArray(data) ? data : [])
    .filter((x) => x.position)
    .map((x) => ({
      platform: "remoteok",
      title: `${x.position}${x.company ? " @ " + x.company : ""}`,
      budget:
        x.salary_min || x.salary_max
          ? `${x.salary_min || "?"}-${x.salary_max || "?"} USD/год`
          : null,
      salary_min: x.salary_min || 0,
      salary_max: x.salary_max || 0,
      tags: x.tags || [],
      link: x.url || x.apply_url,
      date:
        typeof x.date === "number"
          ? new Date(x.date * 1000).toISOString()
          : x.date,
      description: String(x.description || "")
        .replace(/<[^>]+>/g, " ")
        .slice(0, 400),
    }));
}

const fl = await parseFlRss("https://www.fl.ru/rss/all.xml");
const mobileRe =
  /мобильн|android|ios|flutter|react\s*native|kotlin|swift|wireguard|\bvpn\b|впн|openvpn|google\s*play|app\s*store/i;
const flMobile = fl.items.filter((i) =>
  mobileRe.test(`${i.title} ${i.description}`),
);

const tagList = ["mobile", "android", "ios", "flutter"];
const rokMap = new Map();
for (const t of tagList) {
  for (const j of await rokTag(t)) rokMap.set(j.link || j.title, j);
}
const engRe =
  /engineer|developer|flutter|react native|android|ios|mobile app|kotlin|swift/i;
const noise =
  /business development|receptionist|crm|designer|profesor|asesor|gestionnaire|concept artist|operations|content designer|head of creative|sales|manager @ temu|executive/i;
const rokDev = [...rokMap.values()].filter(
  (j) => engRe.test(j.title) && !noise.test(j.title),
);

const flCategoryLive = [
  {
    title: "Приложение для визуализации фасадов зданий",
    link: "https://www.fl.ru/projects/5514998/prilojenie-dlya-vizualizatsii-fasadov-zdaniy.html",
  },
  {
    title: "Публикация в Google play",
    link: "https://www.fl.ru/projects/5514607/publikatsiya-v-google-play.html",
  },
  {
    title:
      "Разработка White-Label приложения «Форт»: управление безопасностью объектов",
    link: "https://www.fl.ru/projects/5514381/razrabotka-white-label-prilojeniya-fort-upravlenie-bezopasnostyu-obyektov.html",
  },
  {
    title: "Разработать мобильное приложение на react native или flutter",
    link: "https://www.fl.ru/projects/5514176/razrabotat-mobilnoe-prilojenie-na-react-native-ili-flutter.html",
  },
  {
    title: "Разработать приложение",
    link: "https://www.fl.ru/projects/5512738/razrabotat-prilojenie.html",
  },
  {
    title: "Full-stack доработка iOS приложения (React Native + Python/Django)",
    link: "https://www.fl.ru/projects/5511462/full-stack-dorabotka-ios-prilojeniya-react-native--python-django.html",
  },
].map((x) => ({ platform: "fl_ru", budget: "не указан в ленте", ...x }));

const flServices = [
  { title: "Мобильное под ключ Flutter", price: "150 800 ₽", days: 30 },
  { title: "E-commerce кроссплатформа", price: "325 000 ₽", days: 14 },
  { title: "Разработка мобильного приложения", price: "65 000 ₽", days: 14 },
  { title: "FlutterFlow приложение", price: "104 000 ₽", days: 14 },
  { title: "Flutter iOS+Android под ключ", price: "260 000 ₽", days: 21 },
  { title: "MVP backend+mobile+deploy", price: "208 000 ₽", days: 20 },
  { title: "Flutter для стартапов (пакет)", price: "975 000 ₽", days: 60 },
  { title: "Мобильное под ключ (бюджетный пакет)", price: "26 000 ₽", days: 15 },
  { title: "Публикация App Store + Google Play", price: "9 100 ₽", days: 21 },
  { title: "Верстка 1 экрана Flutter/SwiftUI/Compose", price: "5 850 ₽", days: 2 },
  { title: "Flutter iOS+Android", price: "104 000 ₽", days: 14 },
  { title: "MVP React Native/Flutter", price: "195 000 ₽", days: 21 },
  { title: "Мобильное (iOS & Android) пакет", price: "111 800 ₽", days: 14 },
  { title: "Мобильная разработка пакет", price: "312 000 ₽", days: 21 },
];

const vpn = {
  liveOpen: [],
  archive: [
    {
      platform: "fl_ru",
      status: "archive",
      title: "Приложение VPN по протоколу WireGuard на flutter (ios/android)",
      link: "https://www.fl.ru/projects/archive/page-1983",
      budget: "н/д (архив)",
    },
    {
      platform: "fl_ru",
      status: "closed",
      title:
        "Бот + инфраструктура VPN-сервиса (xray/Marzban, Telegram) — не клиентское приложение",
      link: "https://www.fl.ru/projects/5360345/razrabotka-bota-i-podderjka-infrastrukturyi-dlya-vpn-servisa-na-baze-xray-i-marzban-telegram.html",
      budget: "н/д (закрыт 2024-10)",
    },
  ],
  remoteokVpnTag: 0,
};

const salaries = rokDev
  .filter((j) => j.budget)
  .sort((a, b) => (b.salary_max || 0) - (a.salary_max || 0));

const report = {
  generatedAt: new Date().toISOString(),
  summary:
    "Живых открытых VPN-заказов почти нет. Мобилка: FL категория Mobile + RemoteOK (Flutter/RN/Android) + витрина цен FL Services.",
  coverage: {
    fl_rss_items: fl.items.length,
    fl_rss_mobile_hits: flMobile.length,
    fl_category_mobile: flCategoryLive.length,
    remoteok_dev: rokDev.length,
    remoteok_with_salary: salaries.length,
    blocked: [
      "Weblancer/Freelance.ru/HH — 403",
      "Kwork/Freelancehunt/Upwork — нет credentials",
      "RemoteOK tag vpn — пусто",
    ],
  },
  vpn,
  fl_live_orders: flCategoryLive,
  fl_rss_mobile: flMobile.slice(0, 20),
  remoteok_mobile_dev: rokDev.slice(0, 35),
  prices: {
    fl_services_flutter_rub: flServices,
    remote_salaries_usd_year: salaries,
    market_benchmarks: [
      {
        source: "web3.career Jul 2026",
        role: "Flutter",
        band: "$40–120k/год, avg ~$65k",
      },
      {
        source: "web3.career Jul 2026",
        role: "Android",
        band: "$49–185k/год, avg ~$114k",
      },
    ],
  },
};

mkdirSync(join(root, "data"), { recursive: true });
const out = join(root, "data", "mobile-vpn-report.json");
writeFileSync(out, JSON.stringify(report, null, 2), "utf8");
console.log(
  JSON.stringify(
    {
      out,
      coverage: report.coverage,
      flOrders: report.fl_live_orders.length,
      rokDev: report.remoteok_mobile_dev.length,
      salaries: salaries.map((s) => ({ t: s.title, b: s.budget })),
      servicePriceRange: "5 850 ₽ (экран) … 975 000 ₽ (стартап-пакет)",
    },
    null,
    2,
  ),
);
