import { getAdmin } from "@/lib/admin/guard";
import { uploadMedia } from "@/lib/admin/media";
import { AdminError } from "@/lib/admin/core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Upload from the editor / picker dialogs (admins only). Images are converted to WebP. */
export async function POST(req: Request) {
  const me = await getAdmin();
  if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
  const fd = await req.formData();
  const files = fd.getAll("files").filter((f): f is File => typeof f === "object" && "arrayBuffer" in f && f.size > 0);
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  const items = [];
  try {
    for (const f of files) items.push(await uploadMedia({ email: me.email, type: "admin", ip }, { bytes: Buffer.from(await f.arrayBuffer()), filename: f.name, mime: f.type }));
  } catch (e) {
    return Response.json({ error: e instanceof AdminError ? e.message : String(e), items }, { status: 400 });
  }
  return Response.json({ items });
}
