import { loadEnv } from "../env.js";
import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
function hhHeaders() {
    loadEnv();
    const ua = process.env.HH_USER_AGENT ||
        "WorkixMCP/0.1 (dev@workix.co; +https://workix.co)";
    const headers = {
        "User-Agent": ua,
        Accept: "application/json",
    };
    const token = process.env.HH_APP_TOKEN?.trim();
    if (token)
        headers.Authorization = `Bearer ${token}`;
    return headers;
}
export async function fetchHhJobs(opts) {
    const text = opts?.text || "разработчик";
    const perPage = 50;
    const maxPages = opts?.pages ?? 1;
    const jobs = [];
    let lastError;
    // remote + project; second pass part-time remote
    const queries = [
        `schedule=remote&employment=project&text=${encodeURIComponent(text)}`,
        `schedule=remote&employment=part&text=${encodeURIComponent(text)}`,
    ];
    for (const q of queries) {
        for (let page = 0; page < maxPages; page++) {
            const url = `https://api.hh.ru/vacancies?${q}&per_page=${perPage}&page=${page}`;
            const { data, error, status } = await fetchJson(url, { headers: hhHeaders(), proxy: false });
            if (error || !data?.items) {
                lastError = error || `HH HTTP ${status}`;
                break;
            }
            for (const v of data.items) {
                const link = v.alternate_url || `https://hh.ru/vacancy/${v.id}`;
                const desc = [v.snippet?.requirement, v.snippet?.responsibility]
                    .filter(Boolean)
                    .join(" ");
                let budget;
                if (v.salary) {
                    const parts = [v.salary.from, v.salary.to].filter((x) => x != null);
                    budget = parts.length
                        ? `${parts.join("–")} ${v.salary.currency || "RUR"}`
                        : undefined;
                }
                jobs.push({
                    id: jobId("hh", link),
                    platform: "hh",
                    kind: "job",
                    title: v.name,
                    description: `${v.employer?.name ? v.employer.name + ". " : ""}${desc}`,
                    link,
                    date: v.published_at || new Date().toISOString(),
                    budget,
                    fetchedAt: new Date().toISOString(),
                    raw: v,
                });
            }
            if (data.items.length < perPage)
                break;
        }
    }
    // dedupe by id
    const map = new Map(jobs.map((j) => [j.id, j]));
    return {
        jobs: [...map.values()],
        error: map.size === 0 ? lastError : undefined,
    };
}
