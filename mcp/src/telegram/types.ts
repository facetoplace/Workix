export type TdAuthState =
  | "missing_deps"
  | "missing_credentials"
  | "wait_phone"
  | "wait_code"
  | "wait_password"
  | "wait_registration"
  | "ready"
  | "logging_out"
  | "closed"
  | "unknown";

export type TgMessageHit = {
  id: string;
  platform: "telegram";
  kind: "gig";
  title: string;
  description: string;
  link: string;
  date: string;
  chat: string;
  chatId: number;
  messageId: number;
};

export type TgBackend = "gramjs" | "tdlib" | "none";
