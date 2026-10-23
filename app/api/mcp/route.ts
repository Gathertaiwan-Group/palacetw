import { timingSafeEqual } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildServer } from "@/lib/mcp/server";
import { publishDue } from "@/lib/admin/posts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: Request) {
  const expected = process.env.MCP_TOKEN;
  if (!expected || expected.length < 32) return false;
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") || "");
  if (!m) return false;
  const a = Buffer.from(m[1].trim());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** MCP (Streamable HTTP, stateless, JSON responses): a fresh server + transport per request — serverless friendly. */
async function handle(req: Request) {
  if (!authorized(req)) {
    return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null }), {
      status: 401,
      headers: { "content-type": "application/json", "www-authenticate": 'Bearer realm="mcp"' },
    });
  }
  if (req.method === "POST") await publishDue().catch(() => 0);
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  const server = buildServer({ email: "mcp", type: "mcp", ip });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    void transport.close().catch(() => null);
    void server.close().catch(() => null);
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
