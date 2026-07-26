import { refreshJobs } from "../fetchJobs.js";
import { getJob, listJobs } from "../store.js";

export async function runGetJob(args: {
  id?: string;
  url?: string;
  refresh?: boolean;
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

  if (!job) {
    return {
      error: "Заказ не найден в store. Вызовите workix_digest / workix_search сначала.",
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
