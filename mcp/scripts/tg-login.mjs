#!/usr/bin/env node
/**
 * Interactive Telegram login (GramJS — works on Windows ARM64).
 *
 *   cd mcp && npm install telegram && npm run tg:login
 *
 * Modes:
 *   npm run tg:login           — phone + code (code usually in Telegram app, not SMS)
 *   npm run tg:login -- --sms  — force SMS resend path
 *   npm run tg:login -- --qr   — QR login (scan with phone Telegram; no SMS)
 */
import { createInterface } from "node:readline";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenv } from "dotenv";

const MCP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const p of [join(MCP_ROOT, ".env"), join(MCP_ROOT, "..", ".env")]) {
  if (existsSync(p)) dotenv({ path: p, override: false });
}

const args = new Set(process.argv.slice(2));
const FORCE_SMS = args.has("--sms") || process.env.TELEGRAM_FORCE_SMS === "1";
const USE_QR = args.has("--qr") || process.env.TELEGRAM_LOGIN_QR === "1";

function ask(rl, q) {
  return new Promise((resolve) => rl.question(q, (a) => resolve(String(a || "").trim())));
}

/** Prefer TELEGRAM_2FA_PASSWORD from env (best for Windows paste issues). Else visible prompt. */
async function ask2fa(rl, hint) {
  const fromEnv = String(process.env.TELEGRAM_2FA_PASSWORD || "").trim();
  if (fromEnv) {
    console.log("(using TELEGRAM_2FA_PASSWORD from env — DELETE it from .env after OK login)");
    return fromEnv;
  }
  if (!process.stdin.isTTY) {
    throw new Error(
      "2FA needed but no TTY. Add to .env temporarily:\n  TELEGRAM_2FA_PASSWORD=your_cloud_password\nthen: npm run tg:login -- --qr",
    );
  }
  console.log(
    "\n2FA cloud password — visible input. Paste: right-click or Ctrl+Shift+V.\n" +
      "Or put TELEGRAM_2FA_PASSWORD=... in .env and re-run (remove after login).\n",
  );
  return ask(rl, `2FA password${hint ? ` (${hint})` : ""}: `);
}

function apiCreds() {
  const apiId = Number(
    process.env.TELEGRAM_API_ID ||
      process.env.TG_APP_API_ID ||
      process.env.TG_API_ID ||
      0,
  );
  const apiHash = String(
    process.env.TELEGRAM_API_HASH ||
      process.env.TG_APP_API_HASH ||
      process.env.TG_API_HASH ||
      "",
  ).trim();
  return { apiId, apiHash };
}

function sessionPath() {
  const dataRoot = process.env.WORKIX_MCP_DATA?.trim() || join(MCP_ROOT, "data");
  const dir = join(dataRoot, "telegram");
  mkdirSync(dir, { recursive: true });
  return join(dir, "gramjs.session");
}

async function finishOk(client, path) {
  const session = client.session.save();
  writeFileSync(path, String(session), "utf8");
  const me = await client.getMe();
  const name =
    [me.firstName, me.lastName].filter(Boolean).join(" ") ||
    me.username ||
    me.id;
  console.log(`\nOK — logged in as ${name} (id ${me.id}) [GramJS]`);
  console.log(`Session: ${path}`);
  console.log("Restart Workix MCP → workix_tg_status → workix_tg_search\n");
}

async function loginQr(apiId, apiHash) {
  const { TelegramClient } = await import("telegram");
  const { StringSession } = await import("telegram/sessions/index.js");
  const path = sessionPath();
  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
    deviceModel: "Workix MCP CLI",
    appVersion: "0.3",
  });

  console.log(`
QR login — no SMS needed.
1) Open Telegram on your phone → Settings → Devices → Link Desktop Device
2) Scan the QR below (or open the tg:// URL if printed)
`);

  await client.connect();
  await client.signInUserWithQrCode(
    { apiId, apiHash },
    {
      qrCode: async (code) => {
        // code.token is Buffer; URL is tg://login?token=base64url
        const token = Buffer.from(code.token).toString("base64url");
        const url = `tg://login?token=${token}`;
        console.log("\n--- Scan this with Telegram mobile ---\n");
        console.log(url);
        console.log("\n(Waiting for scan…)\n");
        try {
          const qrcode = await import("qrcode-terminal").catch(() => null);
          if (qrcode?.default?.generate) {
            qrcode.default.generate(url, { small: true });
          } else if (qrcode?.generate) {
            qrcode.generate(url, { small: true });
          }
        } catch {
          /* URL is enough */
        }
      },
      password: async (hint) => {
        const fromEnv = String(process.env.TELEGRAM_2FA_PASSWORD || "").trim();
        if (fromEnv) {
          console.log("(using TELEGRAM_2FA_PASSWORD from env — DELETE after OK)");
          return fromEnv;
        }
        if (!process.stdin.isTTY) {
          throw new Error(
            "2FA needed. Add TELEGRAM_2FA_PASSWORD=... to .env, then npm run tg:login -- --qr",
          );
        }
        const rl = createInterface({
          input: process.stdin,
          output: process.stdout,
          terminal: true,
        });
        try {
          return await ask2fa(rl, hint);
        } finally {
          rl.close();
        }
      },
      onError: (err) => {
        const msg = err?.message || String(err);
        if (!/readline was closed/i.test(msg)) console.error(msg);
      },
    },
  );
  await finishOk(client, path);
  await client.disconnect().catch(() => null);
}

async function loginPhone(apiId, apiHash) {
  const { TelegramClient } = await import("telegram");
  const { StringSession } = await import("telegram/sessions/index.js");
  const path = sessionPath();
  const saved = existsSync(path) ? readFileSync(path, "utf8").trim() : "";

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log(`
Phone login via GramJS.

IMPORTANT: Telegram usually sends the login code INSIDE the Telegram app
(chat with "Telegram" / official account) — NOT as SMS.
Check the phone that owns this number, open Telegram, look at recent chats.

Force SMS this run: ${FORCE_SMS ? "YES (--sms)" : "no (default app). Retry with: npm run tg:login -- --sms"}
Or use QR (no code): npm run tg:login -- --qr
`);

  const client = new TelegramClient(new StringSession(saved), apiId, apiHash, {
    connectionRetries: 5,
    deviceModel: "Workix MCP CLI",
    appVersion: "0.3",
  });

  try {
    await client.start({
      forceSMS: FORCE_SMS,
      phoneNumber: async () => {
        const phone = await ask(rl, "Phone (+… international): ");
        if (!phone.startsWith("+")) throw new Error("Phone must start with +, e.g. +79001234567");
        return phone;
      },
      phoneCode: async (isCodeViaApp) => {
        if (isCodeViaApp) {
          console.log(
            "\n→ Code was sent TO THE TELEGRAM APP (not SMS). Open Telegram on that phone.\n",
          );
        } else {
          console.log("\n→ Code should arrive by SMS.\n");
        }
        return ask(rl, "Login code: ");
      },
      password: async (hint) => ask2fa(rl, hint),
      onError: (err) => {
        const msg = err?.errorMessage || err?.message || String(err);
        console.error("Auth error:", msg);
        if (/FLOOD|WAIT/i.test(msg)) {
          console.error("Too many attempts — wait the shown seconds, then try again (or --qr).");
        }
      },
    });
    await finishOk(client, path);
  } finally {
    rl.close();
    await client.disconnect().catch(() => null);
  }
}

async function main() {
  const { apiId, apiHash } = apiCreds();
  if (!apiId || apiHash.length < 16) {
    console.error(`
Missing TG_APP_API_ID / TG_APP_API_HASH.

1) https://my.telegram.org/apps
2) Put into repo .env
3) npm install telegram
4) npm run tg:login
   or: npm run tg:login -- --qr
`);
    process.exit(1);
  }

  try {
    await import("telegram");
  } catch (e) {
    console.error("Install first:\n  npm install telegram\n", e.message || e);
    process.exit(1);
  }

  if (USE_QR) {
    await loginQr(apiId, apiHash);
  } else {
    await loginPhone(apiId, apiHash);
  }
}

main().catch((e) => {
  console.error("Login failed:", e?.message || e);
  console.error("\nTips: code is often IN the Telegram app. Try: npm run tg:login -- --qr");
  process.exit(1);
});
