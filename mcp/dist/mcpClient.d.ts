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
export declare function callMcpTool(opts: {
    url: string;
    tool: string;
    args: Record<string, unknown>;
    /** Bearer token for servers that gate tools/call behind an account. */
    token?: string;
    timeoutMs?: number;
}): Promise<McpToolResult>;
