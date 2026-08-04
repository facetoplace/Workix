import { listOutreach, logOutreach } from "../store.js";
const STATUSES = [
    "draft",
    "sent",
    "ok",
    "skip",
    "reply",
    "blocked",
];
function asStatus(v) {
    if (!v)
        return undefined;
    const s = v.trim().toLowerCase();
    return STATUSES.includes(s) ? s : undefined;
}
/** Log a draft / sent outreach (TG, HH, email, board). Local store only. */
export async function runOutreachLog(args) {
    const status = asStatus(args.status);
    if (!status) {
        return {
            error: `status must be one of: ${STATUSES.join(", ")}`,
        };
    }
    if (!args.channel?.trim())
        return { error: "channel required (tg|hh|kwork|email|…)" };
    if (!args.contact?.trim())
        return { error: "contact required (@user / email / name)" };
    if (!args.text?.trim())
        return { error: "text required (message body that was drafted/sent)" };
    const rec = logOutreach({
        status,
        channel: args.channel,
        contact: args.contact,
        text: args.text,
        project: args.project,
        url: args.url,
        jobId: args.job_id,
        note: args.note,
        at: args.at,
        id: args.id,
    });
    return {
        saved: true,
        outreach: rec,
        hint: "Also append a row to docs/apply-log-*.md Outreach table. After user confirms send, update status to sent/ok.",
    };
}
/** List recent outreach; check before writing the same contact again. */
export async function runOutreachList(args) {
    const status = asStatus(args.status);
    if (args.status && !status) {
        return { error: `status must be one of: ${STATUSES.join(", ")}` };
    }
    const items = listOutreach({
        status,
        contact: args.contact,
        channel: args.channel,
        limit: args.limit,
    });
    return {
        count: items.length,
        items: items.map((o) => ({
            id: o.id,
            at: o.at,
            status: o.status,
            channel: o.channel,
            contact: o.contact,
            project: o.project,
            url: o.url,
            jobId: o.jobId,
            note: o.note,
            text_preview: o.text.replace(/\s+/g, " ").trim().slice(0, 160),
            text: o.text,
        })),
    };
}
