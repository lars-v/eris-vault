import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sheetUploads } from "@/db/schema";
import { can } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

/** The uploaded sheet file, for the player who uploaded it and for Jay and admins. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer || !can.useApp(viewer)) return new Response("Sign in first.", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const [row] = await db.select().from(sheetUploads).where(eq(sheetUploads.id, id)).limit(1);
  if (!row || (row.ownerId !== viewer.userId && !can.approve(viewer))) return new Response("Not found", { status: 404 });

  // The type was set from the file's own bytes at upload. PDFs download rather
  // than render here, so nothing a player uploaded runs on this site.
  const filename = row.filename.replace(/[^\w .()-]/g, "_");
  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.contentType,
      "Content-Disposition": `${row.contentType === "application/pdf" ? "attachment" : "inline"}; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'",
      "Cache-Control": "private, no-store",
    },
  });
}
