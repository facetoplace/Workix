export type PlatformId =
  | "fl_ru"
  | "freelance_ru"
  | "weblancer_net"
  | "kwork"
  | string;

/** `lead` = outbound material (a launch, a funded startup), not something to apply to. */
export type JobKind = "gig" | "job" | "service" | "lead";

export interface Job {
  id: string;
  platform: PlatformId;
  kind?: JobKind;
  title: string;
  description: string;
  link: string;
  date: string;
  budget?: string;
  raw?: unknown;
  fetchedAt: string;
}

export interface HubShareInfo {
  at: string;
  sid: string;
  hubUrl: string;
  hubId?: string;
  /** created = new on hub; exists = already on hub (skipped by API) */
  status: "created" | "exists";
}

export interface StoredJob extends Job {
  seenAt: string;
  shownInDigest?: boolean;
  /** Set when mirrored to workix.co via share */
  hubShare?: HubShareInfo;
}

/** History row: job was pushed / known on workix.co catalog */
export interface HubShareRecord {
  id: string;
  at: string;
  jobId: string;
  platform: string;
  title: string;
  externalUrl: string;
  sid: string;
  hubUrl: string;
  hubId?: string;
  status: "created" | "exists";
}

export interface DraftRecord {
  jobId: string;
  text: string;
  createdAt: string;
}

/** Local outreach / apply log (TG, HH, email, boards). */
export type OutreachStatus =
  | "draft"
  | "sent"
  | "ok"
  | "skip"
  | "reply"
  | "blocked";

export interface OutreachRecord {
  id: string;
  at: string;
  status: OutreachStatus;
  channel: string;
  contact: string;
  project?: string;
  url?: string;
  jobId?: string;
  text: string;
  note?: string;
}

/** Where a search/outreach session stopped — resume from here. */
export interface CheckpointRecord {
  id: string;
  at: string;
  summary: string;
  next?: string;
  surfaces?: string[];
  batch?: string;
  blocked?: string[];
  note?: string;
}

export interface PlatformConfig {
  id: string;
  name: string;
  tier: string;
  kind: string;
  region: string;
  audience: string;
  access: string;
  apply: string;
  status?: string;
  rss?: string;
  note?: string;
  refs?: string[];
  /** Downloadable MCP adapter module id (omit for core RSS). */
  module?: string;
  /** Surfaces exposed by a discovery-only network (not necessarily ingested yet). */
  surfaces?: string[];
  /** How Workix connects to a non-job network. */
  integration?: string;
}
