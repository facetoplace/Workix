import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
export function superjobConfigured() {
    return Boolean(process.env.SUPERJOB_APP_ID?.trim());
}
export async function fetchSuperJobJobs(opts) {
    const appId = process.env.SUPERJOB_APP_ID?.trim();
    if (!appId) {
        return { jobs: [], error: "superjob: SUPERJOB_APP_ID missing (optional)" };
    }
    const keyword = opts?.keyword?.trim() || process.env.SUPERJOB_KEYWORD?.trim() || "";
    const count = Math.min(Math.max(opts?.count ?? 100, 1), 100);
    const qs = new URLSearchParams({ count: String(count), page: "0" });
    if (keyword)
        qs.set("keyword", keyword);
    if (process.env.SUPERJOB_TOWN?.trim()) {
        qs.set("town", process.env.SUPERJOB_TOWN.trim());
    }
    // 2 = удалённая работа in SuperJob's place_of_work dictionary.
    if (process.env.SUPERJOB_REMOTE_ONLY === "1")
        qs.set("place_of_work", "2");
    const { data, error, status } = await fetchJson(`https://api.superjob.ru/2.0/vacancies/?${qs}`, {
        headers: {
            "X-Api-App-Id": appId,
            Accept: "application/json",
            "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
        },
    });
    if (error || !data?.objects) {
        return { jobs: [], error: error || `SuperJob HTTP ${status}` };
    }
    const jobs = [];
    for (const v of data.objects) {
        if (!v.profession || !v.link || v.is_closed)
            continue;
        const cur = v.currency || "rub";
        const budget = v.payment_from && v.payment_to
            ? `${v.payment_from}–${v.payment_to} ${cur}`
            : v.payment_from
                ? `от ${v.payment_from} ${cur}`
                : v.payment_to
                    ? `до ${v.payment_to} ${cur}`
                    : undefined;
        jobs.push({
            id: jobId("superjob", String(v.id || v.link)),
            platform: "superjob",
            kind: "job",
            title: `${v.profession}${v.firm_name ? ` @ ${v.firm_name}` : ""}`,
            description: `${v.candidat || ""}\n${v.work || ""}`
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 4000),
            link: v.link,
            date: v.date_published
                ? new Date(v.date_published * 1000).toISOString()
                : new Date().toISOString(),
            budget,
            fetchedAt: new Date().toISOString(),
            raw: {
                town: v.town?.title,
                place_of_work: v.place_of_work?.title,
                type_of_work: v.type_of_work?.title,
            },
        });
    }
    return { jobs, totalCount: data.total };
}
