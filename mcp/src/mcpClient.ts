/**
 * Minimal client for remote MCP servers over streamable HTTP.
 *
 * A growing number of job boards ship an MCP server and nothing else — Dice is
 * tech-only US roles with visa-sponsorship flags, Workopia is ATS aggregation
 * across 90+ countries. Reaching them means being an MCP *client*, not just a
 * server, so this is the shared piece: JSON-RPC over POST, one round of
 * initialize, then tools/call.
 *
 * Three things the transport actually requires in practice:
 *
 *  - Answers arrive either as plain JSON or as a single SSE frame
 *    ("event: message\ndata: {...}"). Both are valid streamable HTTP; a client
 *    that handles only one silently breaks on half the servers.
 *  - Servers that keep state hand back an `mcp-session-id` header on
 *    initialize and reject later calls without it. Servers that do not (Dice)
 *    send no header, so it has to be optional rather than required.
 *  - `initialize` must be followed by the `notifications/initialized` message
 *    before tools/call on spec-strict servers. It costs one request and
 *    nothing when unnecessary.
 */

const PROTOCOL_VERSION = "2025-06-18";
const CLIENT_INFO = { name: "workix-mcp", version: "0.3.2" };

export interface McpToolResult {
  /** Parsed JSON from the first text block, when it is JSON. */
  data?: unknown;
  /** Raw first text block — populated even when it is not JSON. */
  text?: string;
  /** Server-side `structuredContent`, when the tool provides one. */
  structured?: unknown;
  isError?: boolean;
  error?: string;
}

interface RpcEnvelope {
  result?: {
    content?: Array<{ type?: string; text?: string }>;
    structuredContent?: unknown;
    isError?: boolean;
  };
  error?: { code?: number; message?: string };
}

/**
 * Pull the JSON-RPC envelope out of a response body that may be an SSE stream.
 * Takes the last `data:` frame — servers may send progress notifications
 * ahead of the real answer.
 */
function unwrap(body: string): unknown {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("empty response");
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);

  const frames = trimmed
    .split(/\n\n+/)
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join(""),
    )
    .filter((d) => d.startsWith("{"));

  if (!frames.length) throw new Error("no JSON frame in SSE response");
  return JSON.parse(frames[frames.length - 1]);
}

export async function callMcpTool(opts: {
  url: string;
  tool: string;
  args: Record<string, unknown>;
  /** Bearer token for servers that gate tools/call behind an account. */
  token?: string;
  timeoutMs?: number;
}): Promise<McpToolResult> {
  const timeoutMs = opts.timeoutMs ?? 45000;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const post = async (payload: unknown): Promise<Response> =>
    fetch(opts.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

  try {
    const init = await post({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: CLIENT_INFO,
      },
    });
    if (!init.ok) {
      return { error: `initialize HTTP ${init.status}` };
    }
    // Stateful servers pin the conversation to this id; stateless ones omit it.
    const session = init.headers.get("mcp-session-id");
    if (session) headers["mcp-session-id"] = session;
    await init.text();

    // Fire-and-forget: a 202 or a 404 here both mean "carry on".
    await post({ jsonrpc: "2.0", method: "notifications/initialized" }).catch(
      () => undefined,
    );

    const res = await post({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: opts.tool, arguments: opts.args },
    });
    const body = await res.text();
    if (!res.ok) {
      return { error: `${opts.tool} HTTP ${res.status}: ${body.slice(0, 200)}` };
    }

    const env = unwrap(body) as RpcEnvelope;
    if (env.error) {
      return {
        error: `${opts.tool}: ${env.error.message || `rpc ${env.error.code}`}`,
      };
    }

    const text = env.result?.content?.find((c) => c.text)?.text;
    let data: unknown;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        /* not JSON — callers fall back to `text` */
      }
    }
    return {
      data,
      text,
      structured: env.result?.structuredContent,
      isError: env.result?.isError,
    };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { error: `${opts.tool}: timed out after ${timeoutMs}ms` };
    }
    return { error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}
