import { jobState } from "../store.js";
import { hubListApplications } from "./hub.js";
/**
 * One lookup that answers "what has already been done with this card" —
 * shown in a digest, mirrored to the hub, drafted, applied to — plus the next
 * step that follows from that state. Meant to be called before drafting or
 * submitting, so the agent never re-applies to something it already handled.
 *
 * The local store only knows about this machine, so the hub application tracker
 * is consulted too: an apply made from another device (or before mcp/data was
 * wiped) still counts as applied here.
 */
export async function runJobState(args) {
    const key = args.job_id?.trim() || args.url?.trim();
    if (!key) {
        return { ok: false, error: "job_id or url is required" };
    }
    const s = jobState(key);
    const hubApplication = await lookupHubApplication({
        url: args.url?.trim() || (s.found ? s.job.link : ""),
        check: args.check_hub,
    });
    if (!s.found) {
        return {
            ok: false,
            found: false,
            id: key,
            hub_application: hubApplication,
            hint: hubApplication
                ? "Not in the local store, but workix.co has an application for this URL — see hub_application before applying again."
                : "Not in the local store. Run workix_search / workix_digest, or capture it with workix_get_job (url + platform + title).",
        };
    }
    // channel="hub" rows are catalog mirrors, not applications. Counting them as
    // "applied" would tell the agent a job is handled when nobody has replied to
    // the client at all.
    const applyAttempts = s.outreach.filter((o) => o.channel !== "hub");
    const applied = applyAttempts.filter((o) => ["sent", "ok", "reply"].includes(o.status));
    const appliedAnywhere = applied.length > 0 || !!hubApplication;
    const next = [];
    if (!appliedAnywhere && !s.draft) {
        next.push("workix_draft_proposal — no draft yet");
    }
    if (!appliedAnywhere) {
        next.push(applyAttempts.length
            ? `apply not confirmed (last: ${applyAttempts[0].status}) — workix_submit_proposal (confirm:true) or workix_prepare_browser_apply`
            : "not applied yet: workix_submit_proposal (confirm:true) or workix_prepare_browser_apply");
    }
    if (!s.hubShare) {
        next.push("not on workix.co: workix_share_jobs to mirror it");
    }
    // Applied locally but the hub never heard about it — no cross-device history,
    // and the listing is missing an apply.
    if (applied.length && !hubApplication) {
        next.push("applied but not tracked on workix.co: workix_track_apply (keeps history cross-device)");
    }
    if (appliedAnywhere && s.hubShare && hubApplication)
        next.push("nothing outstanding");
    return {
        ok: true,
        found: true,
        job: {
            id: s.job.id,
            platform: s.job.platform,
            title: s.job.title,
            link: s.job.link,
            date: s.job.date,
            budget: s.job.budget,
            seenAt: s.job.seenAt,
            fetchedAt: s.job.fetchedAt,
        },
        // Already surfaced to the user — digest only_new hides it from now on.
        shown_in_digest: s.shownInDigest,
        shown_at: s.shownAt,
        // Mirrored into the workix.co catalog.
        hub_share: s.hubShare
            ? {
                sid: s.hubShare.sid,
                url: s.hubShare.hubUrl,
                status: s.hubShare.status,
                at: s.hubShare.at,
            }
            : null,
        draft: s.draft
            ? { createdAt: s.draft.createdAt, preview: s.draft.text.slice(0, 200) }
            : null,
        // Apply attempts only — the catalog mirror is reported under hub_share.
        outreach: applyAttempts.map((o) => ({
            at: o.at,
            status: o.status,
            channel: o.channel,
            contact: o.contact,
            note: o.note,
        })),
        // Backend tracker — survives a wiped local store and other devices.
        hub_application: hubApplication,
        applied: appliedAnywhere,
        applied_locally: applied.length > 0,
        last_outreach_status: applyAttempts[0]?.status ?? null,
        next,
    };
}
/** Non-fatal: no key, no network or a hub error just means "unknown". */
async function lookupHubApplication(opts) {
    if (opts.check === false || !opts.url)
        return null;
    if (!process.env.WORKIX_AGENT_KEY && !process.env.WORKIX_API_KEY)
        return null;
    try {
        const res = (await hubListApplications({ url: opts.url, limit: 1 }));
        if (!res.ok)
            return null;
        const row = res.data?.items?.[0];
        if (!row)
            return null;
        return {
            id: String(row.id || ""),
            status: String(row.status || ""),
            appliedAt: String(row.appliedAt || ""),
            via: String(row.via || ""),
            channel: String(row.channel || ""),
            hasText: !!row.hasText,
        };
    }
    catch {
        return null;
    }
}
