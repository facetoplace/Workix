export type PlatformId =
  | "fl_ru"
  | "freelance_ru"
  | "weblancer_net"
  | "kwork"
  | string;

export type JobKind = "gig" | "job" | "service";

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

export interface StoredJob extends Job {
  seenAt: string;
  shownInDigest?: boolean;
}

export interface DraftRecord {
  jobId: string;
  text: string;
  createdAt: string;
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
}
