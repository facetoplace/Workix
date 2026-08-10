import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { getJob, getLatestDraft, dataDir } from "../store.js";
const PLATFORM_TIPS = {
    kwork: [
        "На странице проекта Kwork найди «Предложить услугу» / форму оффера.",
        "Заполни срок и цену, если поля есть; текст — в комментарий.",
        "Капча/бан IP → PROXY_1 / VPN.",
    ],
    fl_ru: [
        "Нужен аккаунт FL (часто PRO) и сессия в браузере.",
        "Кнопка «Ответить на проект» / форма отклика.",
    ],
    freelance_ru: ["Форма отклика на карточке проекта; может требовать подписку."],
    weblancer_net: ["Отклик/ставка на странице проекта Weblancer."],
    freelancehunt: [
        "Если API bid не сработал — форма ставки на странице проекта.",
    ],
    hh: [
        "Сессия уже есть: профиль Chrome в mcp/data/browser/hh (npm run hh:login). Открывай отклик в НЁМ, иначе hh попросит логин заново.",
        "Проверить перед откликом: workix_hh_status → authorized:true. Если false — npm run hh:login.",
        "Готовый путь: node scripts/hh-apply.mjs --id <vacancyId> --text-file <file> [--send]. Полностью описано в mcp/HH.md — прочитай перед тем, как писать свой скрипт.",
        "КЛИК ПО «Откликнуться» МОЖЕТ БЫТЬ САМИМ ОТКЛИКОМ: если сопроводительное необязательное, модалка не откроется, а отклик уже создан. «Просто открыть форму» — не безопасное действие.",
        "Поле сопроводительного хранит черновик — очистить (Ctrl+A, Backspace) перед вводом, иначе текст задвоится и перемешается.",
        "Вводить настоящими нажатиями клавиш; переводы строк — только Shift+Enter. Обычный Enter отправляет форму, а присваивание value не обновляет состояние React (уйдёт пустое письмо).",
        "Перед отправкой сверить текст в поле с утверждённым символ в символ; не совпало — отменить.",
        "Успех подтверждать фактом (кнопка отклика исчезла после перезагрузки), а не тем, что клик отработал.",
        "Форма незнакомая (вместо письма анкета vacancy-response-question_*) — не гадать, отдать человеку.",
        "Признак «уже откликались» — ОТСУТСТВИЕ кнопки vacancy-response-link-top. Строка «Вы откликнулись» лежит в JS-бандле и есть на каждой странице.",
        "Один отклик = одно явное «ок» от пользователя. Массовые отклики нарушают правила hh и ведут к бану аккаунта.",
    ],
    remoteok: ["Apply ведёт на сайт работодателя — форма ATS там."],
    remotive: ["Apply на сайте работодателя / Remotive redirect — ATS снаружи."],
    arbeitnow: ["Apply через URL Arbeitnow → сайт работодателя / ATS."],
    adzuna: ["redirect_url Adzuna → лендинг/ATS работодателя; не биржа ставок."],
    himalayas: [
        "Himalayas: Apply на странице вакансии → ATS работодателя. Credit Himalayas при перепосте ленты.",
    ],
    weworkremotely: [
        "We Work Remotely: Apply на WWR → сайт компании / ATS.",
    ],
    jobicy: [
        "Jobicy: кнопка Apply должна вести на оригинальный job URL (ToS Jobicy).",
    ],
    dreamoffer: [
        "Dream Offer: нативного отклика нет — Apply = источник (TG / LinkedIn / ATS).",
        "Открыть vacancy.html?nn=… → ссылка source_link из raw / «Откликнуться (в источнике)».",
        "TG: короткий текст в ЛС/коммент канала; LinkedIn/ATS — форма работодателя.",
        "После отправки: workix_outreach_log channel=dreamoffer|tg|linkedin.",
        "Не массово — только после явного «ок».",
    ],
    working_nomads: [
        "Working Nomads: Apply на карточке → сайт работодателя / ATS.",
    ],
    themuse: [
        "The Muse: Apply на landing_page → ATS работодателя.",
    ],
    four_day_week: [
        "4 Day Week: Apply на 4dayweek.io/jobs/:slug → employer.",
    ],
    aidevboard: [
        "AI Dev Jobs: Apply на карточке → apply_url / ATS работодателя.",
    ],
    aquent: [
        "Aquent: Apply на aquent.com/find-work/:id; при перепосте credit Aquent.",
    ],
    openwork: [
        "Openwork: claim mission через API/skill.md + wallet; Pilot oversight возможен.",
    ],
    growth_talent: [
        "Growth.Talent: apply через member API (gt_live_…) или форма на job URL.",
        "Ниша growth marketing — не mobile freelance.",
    ],
    claw_earn: [
        "Claw Earn: stake USDC + submit через /agent* или UI /claw-earn/task/:id.",
        "Не вызывать /api/claw/* — канон /claw/* и /agent*.",
    ],
    seekclaw: [
        "SeekClaw: agent Ed25519 / DID auth по skill.md; apply только на seekclaw.com.",
    ],
    superteam_earn: [
        "Superteam Earn: POST /api/agents/submissions/create с Bearer sk_…",
        "Payout — human claim по claimCode; для project нужен telegram human.",
    ],
    rentahuman: [
        "RentAHuman: обратный рынок (агент нанимает людей). Apply/escrow через API key или UI bounty.",
    ],
    upwork: [
        "Нужны Connects на аккаунте и залогиненная сессия Upwork.",
        "Submit Proposal — форма cover letter + ставка; API createJobProposal только при Approve «Submit Proposal» + IDs в env.",
        "Не жать Submit Proposal без «ок».",
    ],
    freelancer_com: [
        "Freelancer.com: форма Place a Bid на странице проекта.",
        "Если API bid не сработал — вставить proposal_text и ставку вручную.",
    ],
    fiverr: [
        "Нужен завершённый Seller Onboarding + active Gig + Get Briefs; сессия в Cursor browser (ключ API не нужен).",
        "Buyer Requests нет — только Briefs match (Your matches) или Custom Offer из Inbox.",
        "Creating an offer: introduction (proposal_text) + цена + delivery / payment type (single / milestones / hourly / subscription).",
        "Не жать Send / Create Offer без явного «ок» пользователя.",
    ],
    profi: [
        "Нужна сессия Profi в браузере (кабинет исполнителя).",
        "Открой карточку заказа / заявки → форма отклика или сообщение заказчику.",
        "Вставь proposal_text; цену/срок — если поля есть.",
        "Не отправлять без явного «ок».",
    ],
    avito: [
        "Нужна сессия Avito; ToS — только полуручной режим, без массового спама.",
        "Отклик обычно через чат по объявлению / заказу услуг.",
        "Вставь proposal_text в сообщение; не жать Отправить без «ок».",
    ],
    youdo: [
        "Нужна сессия YouDo как исполнитель.",
        "На карточке задания — отклик / предложить цену; вставь proposal_text.",
        "Не отправлять без явного «ок».",
    ],
    sproutgigs: [
        "Нужна сессия sproutgigs.com.",
        "На gig/job — Apply / Submit proof или форма отклика по типу задания.",
        "Вставь proposal_text где есть поле сообщения; не жать Submit без «ок».",
    ],
};
export async function runPrepareBrowserApply(args) {
    const job = getJob(args.job_id);
    if (!job)
        return { error: "job_id не найден" };
    const proposal_text = args.proposal_text?.trim() || getLatestDraft(job.id)?.text || "";
    if (!proposal_text) {
        return {
            error: "Нет текста отклика. Сначала workix_draft_proposal (агент пишет текст) и mode=save.",
        };
    }
    const file = join(dataDir(), `proposal-${job.id}.txt`);
    writeFileSync(file, proposal_text, "utf8");
    const tips = PLATFORM_TIPS[job.platform] || [];
    return {
        platform: job.platform,
        kind: job.kind,
        open_url: job.link,
        proposal_text,
        proposal_file: file,
        hard_rules: [
            "НЕ нажимать «Отправить» / «Откликнуться» без явного «ок» от пользователя.",
            "Сначала открыть страницу, вставить текст, показать пользователю превью.",
            "Если нужна авторизация на площадке — попросить пользователя залогиниться.",
        ],
        platform_tips: tips,
        checklist_for_agent: [
            "1. Открыть open_url через cursor-ide-browser (browser_navigate).",
            "2. browser_snapshot — найти поле отклика / формы предложения.",
            ...tips.map((t, i) => `${i + 3}. ${t}`),
            `${tips.length + 3}. Вставить proposal_text (или содержимое proposal_file).`,
            `${tips.length + 4}. Показать пользователю превью и спросить подтверждение.`,
            `${tips.length + 5}. Только после явного «ок» — клик по кнопке отправки.`,
            `${tips.length + 6}. Сообщить результат (успех / ошибка / капча).`,
        ],
    };
}
