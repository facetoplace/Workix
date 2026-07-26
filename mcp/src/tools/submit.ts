import { kworkConfigured, kworkGetMe } from "../adapters/kwork.js";
import { freelancehuntBid, freelancehuntConfigured } from "../adapters/freelancehunt.js";
import {
  freelancerConfigured,
  freelancerPlaceBid,
  freelancerProjectId,
} from "../adapters/freelancer.js";
import {
  upworkConfigured,
  upworkCreateProposal,
  upworkJobReference,
} from "../adapters/upwork.js";
import { getJob, getLatestDraft } from "../store.js";
import { runPrepareBrowserApply } from "./browser_apply.js";

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

  if (job.platform === "freelancehunt" && freelancehuntConfigured()) {
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
    const bid = await freelancehuntBid({
      projectId,
      days: args.days ?? 7,
      amount: args.amount ?? 1000,
      currency: args.currency || "RUB",
      comment: text,
    });
    if (bid.ok) {
      return { status: "submitted", platform: "freelancehunt", raw: bid.raw };
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

  if (job.platform === "freelancer_com" && freelancerConfigured()) {
    const projectId = freelancerProjectId(job);
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
    const bid = await freelancerPlaceBid({
      projectId,
      amount: args.amount ?? 500,
      period: args.days ?? 7,
      description: text,
    });
    if (bid.ok) {
      return { status: "submitted", platform: "freelancer_com", raw: bid.raw };
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
    if (!upworkConfigured()) {
      return {
        status: "need_browser",
        message: "Upwork OAuth не настроен — browser apply",
        fallback: await runPrepareBrowserApply({
          job_id: job.id,
          proposal_text: text,
        }),
      };
    }
    const jobReference = upworkJobReference(job);
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
    const created = await upworkCreateProposal({
      jobReference,
      coverLetter: text,
      chargedAmount: args.amount ?? 500,
      estimatedDuration: args.days ?? 7,
    });
    if (created.ok) {
      return { status: "submitted", platform: "upwork", raw: created.raw };
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
    if (!kworkConfigured()) {
      return {
        error: "Kwork credentials не заданы",
        fallback: await runPrepareBrowserApply({
          job_id: job.id,
          proposal_text: text,
        }),
      };
    }
    try {
      const me = await kworkGetMe();
      const browser = await runPrepareBrowserApply({
        job_id: job.id,
        proposal_text: text,
      });
      return {
        status: "api_offer_not_available",
        message:
          "Kwork API: auth OK, create offer нет — отправка через браузер.",
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
