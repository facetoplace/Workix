/**
 * Mirror hh.ru negotiations into the local outreach log.
 *
 * The digest drops cards it has already written to by reading `outreach`
 * (contactedKeys). Applications sent through scripts/hh-apply.mjs or by hand on
 * hh.ru never landed there, so hh vacancies the user already applied to kept
 * coming back — vacancy 135881782 resurfaced on 2026-08-13, nine days after the
 * application went out and while hh still listed it as "отклик отправлен".
 *
 * This walks the negotiations list and writes the missing rows. Read-only
 * against hh: it reads the same page workix_hh_negotiations does and sends
 * nothing.
 */
import { getJob, listAllOutreach, logOutreach, normalizeLink } from "../store.js";
import { runHhNegotiations } from "./hh_negotiations.js";
/** Rows this importer owns. Anything else in the log is the user's, untouched. */
const IMPORT_PREFIX = "hh-neg-";
const REPLY_STATES = new Set([
    "INVITATION",
    "INTERVIEW",
    "PHONE_INTERVIEW",
    "ASSESSMENT",
    "OFFER",
    "HIRED",
]);
/**
 * hh's state machine → the outreach vocabulary (draft|sent|ok|skip|reply|blocked).
 * A rejection is `blocked`: the door is shut from the other side, which is what
 * that status means for every other channel. `skip` is for the one case where
 * the applicant withdrew — that was our own decision not to pursue it.
 */
export function outreachStatusForNegotiation(item) {
    const state = String(item.raw_state || "").toUpperCase();
    if (state === "DISCARD_BY_APPLICANT")
        return "skip";
    if (item.rejected || state.startsWith("DISCARD") || state === "RESPONSE_REJECTED") {
        return "blocked";
    }
    if (item.invited || REPLY_STATES.has(state))
        return "reply";
    if (item.unread_messages || item.question_pending)
        return "reply";
    return "sent";
}
function vacancyIdOf(item) {
    const m = String(item.vacancy_url || "").match(/vacancy\/(\d+)/);
    return m?.[1];
}
export async function runHhSyncOutreach(args) {
    const neg = (await runHhNegotiations({
        limit: 200,
        pages: Math.min(Math.max(args.pages ?? 10, 1), 10),
        filter: "all",
    }));
    if (neg.ok === false || !neg.items) {
        return {
            ok: false,
            error: neg.error || "hh negotiations unavailable",
            hint: neg.hint || "cd mcp && npm run hh:login",
            note: "Сессия hh нужна только для чтения списка откликов; ничего не отправляется.",
        };
    }
    const existing = listAllOutreach();
    const byUrl = new Map();
    for (const row of existing) {
        const key = normalizeLink(row.url || undefined);
        if (!key)
            continue;
        const list = byUrl.get(key) || [];
        list.push(row);
        byUrl.set(key, list);
    }
    const created = [];
    const updated = [];
    const unchanged = [];
    const skipped = [];
    const byStatus = {};
    for (const item of neg.items) {
        const vacancyId = vacancyIdOf(item);
        if (!vacancyId || !item.vacancy_url) {
            skipped.push({ vacancy: item.vacancy || "—", reason: "нет vacancy id" });
            continue;
        }
        const status = outreachStatusForNegotiation(item);
        byStatus[status] = (byStatus[status] || 0) + 1;
        const link = normalizeLink(item.vacancy_url);
        const rows = (link && byUrl.get(link)) || [];
        const hhRows = rows.filter((r) => r.channel === "hh");
        const mine = hhRows.find((r) => r.id === `${IMPORT_PREFIX}${vacancyId}`);
        const at = item.applied_at || item.last_change || new Date().toISOString();
        const job = getJob(item.vacancy_url);
        const contact = item.employer || `hh:${vacancyId}`;
        // A row someone else wrote (hh-apply, manual log) carries the real cover
        // letter — never overwrite it. Only its status is refreshed, and only when
        // hh knows something newer than "we sent it".
        const owner = mine || hhRows[0];
        if (owner) {
            const stale = owner.status !== status &&
                (owner.status === "sent" || owner.status === "draft" || owner.id.startsWith(IMPORT_PREFIX));
            if (!stale) {
                unchanged.push(owner.id);
                continue;
            }
            if (!args.dry_run) {
                logOutreach({
                    id: owner.id,
                    at: owner.at,
                    status,
                    channel: "hh",
                    contact: owner.contact,
                    text: owner.text,
                    project: owner.project || item.vacancy,
                    url: owner.url || item.vacancy_url,
                    jobId: owner.jobId || job?.id,
                    note: `hh: ${item.state || status} (синхронизировано ${new Date()
                        .toISOString()
                        .slice(0, 10)})`,
                });
            }
            updated.push({
                id: owner.id,
                from: owner.status,
                to: status,
                vacancy: item.vacancy || vacancyId,
            });
            continue;
        }
        const id = `${IMPORT_PREFIX}${vacancyId}`;
        if (!args.dry_run) {
            logOutreach({
                id,
                at,
                status,
                channel: "hh",
                contact,
                text: `[импорт из hh negotiations] Отклик на «${item.vacancy || vacancyId}» отправлен ${String(at).slice(0, 10)}. Текст сопроводительного письма в этом канале не сохранён.`,
                project: item.vacancy,
                url: item.vacancy_url,
                jobId: job?.id,
                note: `hh: ${item.state || status}${item.messages ? `, сообщений: ${item.messages}` : ""}`,
            });
        }
        created.push({ id, status, vacancy: item.vacancy || vacancyId });
    }
    return {
        ok: true,
        dry_run: Boolean(args.dry_run),
        negotiations: neg.items.length,
        total_on_hh: neg.total_on_hh,
        created: created.length,
        updated: updated.length,
        unchanged: unchanged.length,
        by_status: byStatus,
        created_items: created,
        updated_items: updated,
        ...(skipped.length ? { skipped } : {}),
        note: "Идемпотентно: повторный прогон обновляет те же строки, чужие записи с текстом письма не перезаписываются. hh — только чтение.",
    };
}
