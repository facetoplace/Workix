import { refreshJobs } from "../fetchJobs.js";
import { getJob, jobId, listJobs, upsertJobs } from "../store.js";
import type { Job } from "../types.js";

export async function runGetJob(args: {
  id?: string;
  url?: string;
  refresh?: boolean;
  /** Capture watch/browser lead into store when not found via digest. */
  platform?: string;
  title?: string;
  description?: string;
  budget?: string;
}): Promise<unknown> {
  const key = args.id || args.url;
  if (!key) {
    return { error: "Укажите id или url" };
  }

  let job = getJob(key);
  if (!job && args.refresh !== false) {
    await refreshJobs();
    job = getJob(key);
  }

  if (!job && args.url) {
    job = listJobs().find((j) => j.link.includes(args.url!));
  }

  if (!job && args.url && args.platform?.trim() && args.title?.trim()) {
    const platform = args.platform.trim();
    const link = args.url.trim();
    const captured: Job = {
      id: jobId(platform, link),
      platform,
      kind: "gig",
      title: args.title.trim(),
      description: (args.description || "").trim().slice(0, 4000),
      link,
      date: new Date().toISOString(),
      budget: args.budget?.trim() || undefined,
      fetchedAt: new Date().toISOString(),
      raw: { captured: true, source: "watch_browser" },
    };
    const [stored] = upsertJobs([captured]);
    job = stored;
  }

  if (!job) {
    return {
      error:
        "Заказ не найден в store. Вызовите workix_digest / workix_search сначала — или для watch (Fiverr и т.п.) передайте url + platform + title.",
      queried: key,
    };
  }

  return {
    id: job.id,
    platform: job.platform,
    title: job.title,
    description: job.description,
    link: job.link,
    date: job.date,
    budget: job.budget,
    apply_mode: job.platform === "kwork" ? "browser_or_api_later" : "browser",
    fetchedAt: job.fetchedAt,
  };
}
