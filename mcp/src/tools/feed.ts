/**
 * workix_feed_search — query the hosted aggregated feed (GET /api/v1/feed).
 * Server-side RSS/board aggregation: no local adapters, no credentials, no
 * network fan-out on the client. Read-only and anonymous.
 */
import { loadEnv } from "../env.js";

loadEnv();

function apiBase(): string {
  return (
    process.env.WORKIX_API ||
    process.env.WORKIX_HUB_API ||
    "https://workix.co"
  ).replace(/\/$/, "");
}

export interface FeedSearchArgs {
  q?: string;
  source?: string[];
  since?: string;
  limit?: number;
  offset?: number;
}

export async function runFeedSearch(args: FeedSearchArgs) {
  const params = new URLSearchParams();
  if (args.q) params.set("q", args.q);
  if (args.source?.length) params.set("source", args.source.join(","));
  if (args.since) params.set("since", args.since);
  if (args.limit != null) params.set("limit", String(args.limit));
  if (args.offset != null) params.set("offset", String(args.offset));

  const url = `${apiBase()}/api/v1/feed${params.toString() ? `?${params}` : ""}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error:
          (data as { error?: string })?.error || res.statusText || "request failed",
        url,
      };
    }
    return data;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      url,
    };
  }
}
