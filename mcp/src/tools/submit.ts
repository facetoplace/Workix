import { getAdapter, getAdapterContext, moduleIdForPlatform } from "../adapterLoader.js";
import { getJob, getLatestDraft } from "../store.js";
import type { Job } from "../types.js";
import { runPrepareBrowserApply } from "./browser_apply.js";
import { runTrackApply } from "./apply_track.js";

type BidResult = { ok: boolean; error?: string; raw?: unknown };

/**
 * The agent sent this one itself, so nobody has to be asked whether it went out:
 * record it on the hub (mirroring the job into the catalog) with the exact text.
 * Best-effort — a tracking failure must not mask a successful submit.
 */
async function trackSubmitted(jobId: string, text: string, platform: string) {
  try {
    return await runTrackApply({
      job_id: jobId,
      status: "sent",
      channel: platform,
      via: "agent",
      text,
      note: "auto-tracked from workix_submit_proposal",
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function runSubmitProposal(args: {
  job_id: string;
  confirm?: boolean;
  proposal_text?: string;
  amount?: number;
  days?: number;
  currency?: string;
}): Promise<unknown> {
  if (!args.confirm) {
    return {
      error: "Требуется confirm: true после явного согласия пользователя.",
    };
  }

  const job = getJob(args.job_id);
  if (!job) return { error: "job_id не найден" };

  const text =
    args.proposal_text?.trim() || getLatestDraft(job.id)?.text || "";
  if (!text) {
    return {
      error:
        "Нет текста отклика. Сначала draft + save или передайте proposal_text.",
    };
  }

  const moduleId = moduleIdForPlatform(job.platform);
  const mod = moduleId ? await getAdapter(moduleId) : null;
  const ctx = getAdapterContext();
  const configured =
    typeof mod?.configured === "function" ? mod.configured() : false;

  if (job.platform === "freelancehunt" && mod && configured) {
    const raw = job.raw as { id?: number } | undefined;
    const projectId = raw?.id;
    if (!projectId) {
      return {
        status: "need_browser",
        message: "Нет project id в raw — browser apply",
        fallback: await runPrepareBrowserApply({
          job_id: job.id,
          proposal_text: text,
        }),
      };
    }
    const bidFn = mod.bid as
      | ((
          c: typeof ctx,
          o: {
            projectId: number;
            days: number;
            amount: number;
            currency: string;
            comment: string;
          },
        ) => Promise<BidResult>)
      | undefined;
    if (!bidFn) {
      return {
        status: "need_browser",
        message: "adapter has no bid()",
        fallback: await runPrepareBrowserApply({
          job_id: job.id,
          proposal_text: text,
        }),
      };
    }
    const bid = await bidFn(ctx, {
      projectId,
      days: args.days ?? 7,
      amount: args.amount ?? 1000,
      currency: args.currency || "RUB",
      comment: text,
    });
    if (bid.ok) {
      return {
        status: "submitted",
        platform: "freelancehunt",
        raw: bid.raw,
        tracked: await trackSubmitted(job.id, text, "freelancehunt"),
      };
    }
    return {
      status: "api_failed",
      error: bid.error,
      fallback: await runPrepareBrowserApply({
        job_id: job.id,
        proposal_text: text,
      }),
    };
  }

  if (job.platform === "freelancer_com" && mod && configured) {
    const projectIdFn = mod.projectId as ((j: Job) => number | undefined) | undefined;
    const projectId = projectIdFn?.(job);
    if (!projectId) {
      return {
        status: "need_browser",
        message: "Нет project id — browser apply",
        fallback: await runPrepareBrowserApply({
          job_id: job.id,
          proposal_text: text,
        }),
      };
    }
    const placeBid = mod.placeBid as
      | ((
          c: typeof ctx,
          o: {
            projectId: number;
            amount: number;
            period: number;
            description: string;
          },
        ) => Promise<BidResult>)
      | undefined;
    if (!placeBid) {
      return {
        status: "need_browser",
        fallback: await runPrepareBrowserApply({
          job_id: job.id,
          proposal_text: text,
        }),
      };
    }
    const bid = await placeBid(ctx, {
      projectId,
      amount: args.amount ?? 500,
      period: args.days ?? 7,
      description: text,
    });
    if (bid.ok) {
      return {
        status: "submitted",
        platform: "freelancer_com",
        raw: bid.raw,
        tracked: await trackSubmitted(job.id, text, "freelancer_com"),
      };
    }
    return {
      status: "api_failed",
      error: bid.error,
      fallback: await runPrepareBrowserApply({
        job_id: job.id,
        proposal_text: text,
      }),
    };
  }

  if (job.platform === "upwork") {
    if (!mod || !configured) {
      return {
        status: "need_browser",
        message: "Upwork OAuth не настроен — browser apply",
        fallback: await runPrepareBrowserApply({
          job_id: job.id,
          proposal_text: text,
        }),
      };
    }
    const jobReferenceFn = mod.jobReference as
      | ((j: Job) => string | undefined)
      | undefined;
    const jobReference = jobReferenceFn?.(job);
    if (!jobReference) {
      return {
        status: "need_browser",
        message: "Нет jobReference/ciphertext в raw",
        fallback: await runPrepareBrowserApply({
          job_id: job.id,
          proposal_text: text,
        }),
      };
    }
    const createProposal = mod.createProposal as
      | ((o: {
          jobReference: string;
          coverLetter: string;
          chargedAmount: number;
          estimatedDuration?: number;
        }) => Promise<BidResult & { browserHint?: string }>)
      | undefined;
    if (!createProposal) {
      return {
        status: "need_browser",
        fallback: await runPrepareBrowserApply({
          job_id: job.id,
          proposal_text: text,
        }),
      };
    }
    const created = await createProposal({
      jobReference,
      coverLetter: text,
      chargedAmount: args.amount ?? 500,
      estimatedDuration: args.days ?? 7,
    });
    if (created.ok) {
      return {
        status: "submitted",
        platform: "upwork",
        raw: created.raw,
        tracked: await trackSubmitted(job.id, text, "upwork"),
      };
    }
    return {
      status: "api_failed_or_incomplete",
      error: created.error,
      message:
        "createJobProposal недоступен/не хватает IDs — Connects тратятся в UI. Fallback: browser.",
      fallback: await runPrepareBrowserApply({
        job_id: job.id,
        proposal_text: text,
      }),
    };
  }

  if (job.platform === "kwork") {
    if (!mod || !configured) {
      return {
        error: "Kwork credentials не заданы",
        fallback: await runPrepareBrowserApply({
          job_id: job.id,
          proposal_text: text,
        }),
      };
    }
    try {
      const getMe = mod.getMe as (() => Promise<unknown>) | undefined;
      const me = getMe ? await getMe() : null;
      const browser = await runPrepareBrowserApply({
        job_id: job.id,
        proposal_text: text,
      });
      return {
        status: "api_offer_not_available",
        message:
          "kwork-api: auth OK, create offer нет — отправка через браузер.",
        auth: { ok: true, me },
        fallback: browser,
      };
    } catch (e) {
      return {
        status: "auth_failed",
        error: e instanceof Error ? e.message : String(e),
        fallback: await runPrepareBrowserApply({
          job_id: job.id,
          proposal_text: text,
        }),
      };
    }
  }

  return {
    status: "browser_only",
    message: `API-отправка для ${job.platform} не реализована — browser apply.`,
    fallback: await runPrepareBrowserApply({
      job_id: job.id,
      proposal_text: text,
    }),
  };
}
