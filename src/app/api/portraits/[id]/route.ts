import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { characterPortraits, characters } from "@/db/schema";
import { can } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

/**
 * A character's picture. Everyone signed in can read every sheet, so everyone
 * signed in can see the picture. Links carry `?v=` (the upload time), so a
 * versioned link can be cached; a new picture gets a new link.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer || !can.viewSheet(viewer)) return new Response("Sign in first.", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const [row] = await db
    .select({ contentType: characterPortraits.contentType, data: characterPortraits.data, updatedAt: characterPortraits.updatedAt })
    .from(characterPortraits)
    .innerJoin(characters, eq(characters.id, characterPortraits.characterId))
    .where(and(eq(characterPortraits.characterId, id), isNull(characters.deletedAt)))
    .limit(1);
  if (!row) return new Response("Not found", { status: 404 });

  // The bytes were made by the server (src/lib/portraits.ts), never the uploaded file.
  const versioned = new URL(req.url).searchParams.get("v") === String(row.updatedAt.getTime());
  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.contentType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'",
      "Cache-Control": versioned ? "private, max-age=31536000, immutable" : "private, no-cache",
    },
  });
}
