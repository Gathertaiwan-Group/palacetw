// MCP smoke test with the official SDK client.
// Usage: MCP_URL=http://localhost:3100/api/mcp MCP_TOKEN=... node scripts/mcp-smoke.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = new URL(process.env.MCP_URL || "http://localhost:3100/api/mcp");
const token = process.env.MCP_TOKEN;
if (!token) throw new Error("MCP_TOKEN missing");
const show = (label, v) => console.log(`\n=== ${label}\n${typeof v === "string" ? v : JSON.stringify(v, null, 2)}`);
const text = (r) => r.content?.map((c) => c.text).join("\n") ?? "";
const json = (r) => { if (r.isError) throw new Error(text(r)); return JSON.parse(text(r)); };

// unauthenticated request must be rejected
const bad = await fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
show("no token", `HTTP ${bad.status} ${await bad.text()}`);

const client = new Client({ name: "palacetw-smoke", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
show("server", client.getServerVersion());

const tools = await client.listTools();
show(`tools/list (${tools.tools.length} tools)`, tools.tools.map((t) => t.name).join(", "));

const list = json(await client.callTool({ name: "list_posts", arguments: { type: "post", status: "publish", limit: 3 } }));
show("list_posts (publish, 3)", { total: list.total, items: list.items.map((p) => ({ id: p.id, title: p.title, path: p.path })) });
const one = json(await client.callTool({ name: "get_post", arguments: { id: list.items[0].id } }));
show("get_post", { id: one.id, title: one.title, status: one.status, path: one.path, content_chars: one.content.length, content_head: one.content.replace(/\s+/g, " ").slice(0, 160), terms: one.terms.map((t) => `${t.taxonomy}:${t.name}`) });

const created = json(await client.callTool({ name: "create_post", arguments: { title: "MCP 測試草稿", content: "<p>由 MCP 用戶端建立的草稿。</p>", seo_description: "MCP smoke test" } }));
show("create_post", { id: created.id, status: created.status, slug: created.slug, path: created.path, title: created.title });

const updated = json(await client.callTool({ name: "update_post", arguments: { id: created.id, title: "MCP 測試草稿（已修改）", content: "<p>內容已由 MCP 修改。</p>", category_ids: one.terms.filter((t) => t.taxonomy === "category").map((t) => t.id) } }));
show("update_post", { id: updated.id, status: updated.status, title: updated.title, content: updated.content, terms: updated.terms.map((t) => `${t.taxonomy}:${t.name}`) });

const trashed = json(await client.callTool({ name: "delete_post", arguments: { id: created.id } }));
show("delete_post (trash)", trashed);
const deleted = json(await client.callTool({ name: "delete_post", arguments: { id: created.id, force: true } }));
show("delete_post (force)", deleted);
const gone = await client.callTool({ name: "get_post", arguments: { id: created.id } });
show("get_post after delete", { isError: gone.isError, text: text(gone) });

const audit = json(await client.callTool({ name: "list_audit_log", arguments: { actor_type: "mcp", limit: 4 } }));
show("audit_log (mcp, latest 4)", audit.items.map((a) => ({ id: a.id, actor: a.actor, action: a.action, entity: `${a.entity_type}:${a.entity_id}`, at: a.created_at })));
await client.close();
