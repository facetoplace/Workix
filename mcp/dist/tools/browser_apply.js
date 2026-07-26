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
        "Отклик на HH: кнопка «Откликнуться»; может понадобиться сопроводительное.",
        "Не массово спамить — только после «ок».",
    ],
    remoteok: ["Apply ведёт на сайт работодателя — форма ATS там."],
    upwork: [
        "Нужны Connects на аккаунте и залогиненная сессия Upwork.",
        "Submit Proposal — форма cover letter + ставка; API createJobProposal только при Approve «Submit Proposal» + IDs в env.",
        "Не жать Submit Proposal без «ок».",
    ],
    freelancer_com: [
        "Freelancer.com: форма Place a Bid на странице проекта.",
        "Если API bid не сработал — вставить proposal_text и ставку вручную.",
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
