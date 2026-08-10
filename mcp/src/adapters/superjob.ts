import { fetchJson } from "../http.js";
import { jobId } from "../store.js";
import type { Job } from "../types.js";

/**
 * SuperJob — RU job board, official API 2.0.
 * Register an app at https://api.superjob.ru/ → `SUPERJOB_APP_ID` (the
 * X-Api-App-Id secret key). Search needs no user OAuth.
 *
 * Probed 2026-08-09: the host answers 403 to datacenter IPs even before auth,
 * so on a VPS this wants PROXY_1 — that is why `proxy` is left at the default
 * rather than pinned to false like the other boards.
 */

interface SuperJobVacancy {
  id?: number;
  profession?: string;
  firm_name?: string;
  link?: string;
  date_published?: number;
  payment_from?: number;
  payment_to?: number;
  currency?: string;
  candidat?: string;
  work?: string;
  town?: { title?: string };
  place_of_work?: { title?: string };
  type_of_work?: { title?: string };
  is_closed?: boolean;
}

interface SuperJobResponse {
  objects?: SuperJobVacancy[];
  total?: number;
  more?: boolean;
}

export function superjobConfigured(): boolean {
  return Boolean(process.env.SUPERJOB_APP_ID?.trim());
}

export async function fetchSuperJobJobs(opts?: {
  keyword?: string;
  count?: number;
}): Promise<{ jobs: Job[]; error?: string; totalCount?: number }> {
  const appId = process.env.SUPERJOB_APP_ID?.trim();
  if (!appId) {
    return { jobs: [], error: "superjob: SUPERJOB_APP_ID missing (optional)" };
  }

  const keyword =
    opts?.keyword?.trim() || process.env.SUPERJOB_KEYWORD?.trim() || "";
  const count = Math.min(Math.max(opts?.count ?? 100, 1), 100);

  const qs = new URLSearchParams({ count: String(count), page: "0" });
  if (keyword) qs.set("keyword", keyword);
  if (process.env.SUPERJOB_TOWN?.trim()) {
    qs.set("town", process.env.SUPERJOB_TOWN.trim());
  }
  // 2 = удалённая работа in SuperJob's place_of_work dictionary.
  if (process.env.SUPERJOB_REMOTE_ONLY === "1") qs.set("place_of_work", "2");

  const { data, error, status } = await fetchJson<SuperJobResponse>(
    `https://api.superjob.ru/2.0/vacancies/?${qs}`,
    {
      headers: {
        "X-Api-App-Id": appId,
        Accept: "application/json",
        "User-Agent": "WorkixMCP/0.1 (dev@workix.co)",
      },
    },
  );

  if (error || !data?.objects) {
    return { jobs: [], error: error || `SuperJob HTTP ${status}` };
  }

  const jobs: Job[] = [];
  for (const v of data.objects) {
    if (!v.profession || !v.link || v.is_closed) continue;
    const cur = v.currency || "rub";
    const budget =
      v.payment_from && v.payment_to
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
