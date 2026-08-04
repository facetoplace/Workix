import { listHistory } from "../store.js";

/** Unified local history: hub mirrors + outreach + checkpoints. */
export async function runHistory(args: { limit?: number }): Promise<unknown> {
  const hist = listHistory(args.limit ?? 40);
  return {
    ...hist,
    hint: "hubShares = already on workix.co; outreach = TG/HH/email drafts/sends; checkpoints = where search stopped. Before share: workix_hub_share_status.",
  };
}
