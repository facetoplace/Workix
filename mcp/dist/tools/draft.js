import { loadProfile, profilePathUsed } from "../profile.js";
import { getJob, saveDraft } from "../store.js";
export async function runDraftProposal(args) {
    const job = getJob(args.job_id);
    if (!job) {
        return { error: "job_id не найден. Сначала workix_get_job / digest." };
    }
    if (args.mode === "save") {
        if (!args.text?.trim()) {
            return { error: "Для mode=save нужен text" };
        }
        const rec = saveDraft(job.id, args.text.trim());
        return { saved: true, draft: rec };
    }
    const profile = loadProfile();
    return {
        mode: "brief",
        job: {
            id: job.id,
            platform: job.platform,
            title: job.title,
            description: job.description,
            link: job.link,
            budget: job.budget,
            language_hint: /[а-яА-ЯёЁ]/.test(job.title + job.description)
                ? "ru"
                : "en",
        },
        profile_path: profilePathUsed(),
        profile_excerpt: profile.slice(0, 4000),
        constraints: [
            "Язык отклика = язык заказа",
            "3–5 предложений, без markdown",
            "Упомяни возможные трудности и почему выбрать именно этого специалиста",
            "В конце: примерная стоимость и срок (две строки)",
            "Не обещать невозможное; не врать про опыт",
            "Повтори контакты/стиль из примеров в профиле, если есть",
        ],
        example_style: "Короткий деловой тон. Сначала понимание задачи, затем релевантный опыт, риск/сложность, оффер по сроку и цене.",
        instruction_for_agent: "Напиши готовый текст отклика по brief выше, покажи пользователю. После одобрения сохрани через workix_draft_proposal mode=save.",
    };
}
