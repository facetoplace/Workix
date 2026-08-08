/**
 * Read hh.ru responses ("отклики") with the saved browser session: who replied,
 * who declined, where an employer asked something and is waiting on you.
 *
 * Read-only — nothing is sent, nothing is marked as read.
 */
import { fetchHhState, verifySession } from "../adapters/hh.js";
/** hh state machine → what it actually means for the applicant. */
const STATE_LABEL = {
    RESPONSE: "отклик отправлен, ответа нет",
    INVITATION: "ПРИГЛАШЕНИЕ",
    DISCARD: "отказ",
    DISCARD_BY_APPLICANT: "вы сняли отклик",
    DISCARD_AFTER_INTERVIEW: "отказ после интервью",
    DISCARD_NO_INTERACTION: "отказ (без ответа)",
    DISCARD_VACANCY_CLOSED: "вакансия закрыта",
    INTERVIEW: "ИНТЕРВЬЮ",
    PHONE_INTERVIEW: "телефонное интервью",
    ASSESSMENT: "тестовое / оценка",
    OFFER: "ОФФЕР",
    HIRED: "нанят",
    RESPONSE_REJECTED: "отклик отклонён",
};
function label(state) {
    if (!state)
        return "неизвестно";
    return STATE_LABEL[state] || state;
}
function isRejection(state) {
    return Boolean(state && state.startsWith("DISCARD"));
}
function money(v) {
    if (!v)
        return undefined;
    const parts = [v.from, v.to].filter((x) => x != null);
    return parts.length ? `${parts.join("–")} ${v.currencyCode || "RUR"}` : undefined;
}
export async function runHhNegotiations(args) {
    const auth = await verifySession();
    if (!auth.authorized) {
        return {
            ok: false,
            error: "hh: сессия не авторизована",
            hint: auth.hint || "cd mcp && npm run hh:login",
        };
    }
    const limit = Math.min(Math.max(args.limit ?? 30, 1), 200);
    const maxPages = Math.min(Math.max(args.pages ?? 2, 1), 10);
    const filter = (args.filter || "all").toLowerCase();
    const topics = [];
    const vacancies = new Map();
    let total = 0;
    let counters = null;
    let lastError;
    for (let page = 0; page < maxPages; page++) {
        const { state, error } = await fetchHhState(`https://hh.ru/applicant/negotiations?page=${page}`);
        if (error || !state) {
            lastError = error;
            break;
        }
        const neg = state.applicantNegotiations;
        if (page === 0) {
            total = neg?.total ?? 0;
            counters = state.applicantNegotiationsCounters ?? null;
        }
        const short = state.vacanciesShort;
        for (const v of short?.vacanciesList ?? []) {
            if (v.vacancyId != null)
                vacancies.set(v.vacancyId, v);
        }
        const list = neg?.topicList ?? [];
        topics.push(...list);
        if (!list.length || page + 1 >= (neg?.pageCount ?? 1))
            break;
    }
    if (!topics.length) {
        return {
            ok: !lastError,
            total: 0,
            items: [],
            error: lastError,
            note: lastError ? undefined : "Откликов не найдено",
        };
    }
    let items = topics.map((t) => {
        const v = t.vacancyId != null ? vacancies.get(t.vacancyId) : undefined;
        const rejected = isRejection(t.lastState);
        const unread = Boolean(t.hasNewMessages);
        // A rejection also arrives as an unread message, but there is nothing to
        // answer there — only live threads count as "waiting on you".
        const needsReply = !rejected && (unread || Boolean(t.applicantQuestionState));
        return {
            vacancy: v?.name || (t.vacancyId ? `вакансия ${t.vacancyId}` : "—"),
            employer: v?.company?.visibleName || v?.company?.name,
            salary: money(v?.compensation),
            state: label(t.lastState),
            raw_state: t.lastState,
            rejected,
            invited: t.lastState === "INVITATION" || t.lastState === "INTERVIEW",
            unread_messages: unread,
            question_pending: Boolean(t.applicantQuestionState),
            needs_reply: needsReply,
            messages: t.conversationMessagesCount ?? 0,
            viewed_by_employer: Boolean(t.viewedByOpponent),
            applied_at: t.creationTime,
            last_change: t.lastModified,
            vacancy_url: t.vacancyId ? `https://hh.ru/vacancy/${t.vacancyId}` : undefined,
            chat_url: t.chatId ? `https://hh.ru/chat/${t.chatId}` : undefined,
        };
    });
    if (args.only_new)
        items = items.filter((i) => i.needs_reply);
    if (filter === "invitation")
        items = items.filter((i) => i.invited);
    else if (filter === "rejected")
        items = items.filter((i) => i.rejected);
    else if (filter === "waiting") {
        items = items.filter((i) => !i.rejected && !i.invited);
    }
    // Anything awaiting your reply first, then invitations, then most recent.
    items.sort((a, b) => {
        if (a.needs_reply !== b.needs_reply)
            return a.needs_reply ? -1 : 1;
        if (a.invited !== b.invited)
            return a.invited ? -1 : 1;
        return String(b.last_change).localeCompare(String(a.last_change));
    });
    const shown = items.slice(0, limit);
    return {
        ok: true,
        total_on_hh: total,
        fetched: topics.length,
        shown: shown.length,
        summary: {
            needs_reply: items.filter((i) => i.needs_reply).length,
            invitations: items.filter((i) => i.invited).length,
            rejections: items.filter((i) => i.rejected).length,
            waiting: items.filter((i) => !i.rejected && !i.invited).length,
        },
        counters,
        items: shown,
        error: lastError,
        note: "Read-only: ничего не отправлено и не помечено прочитанным.",
    };
}
