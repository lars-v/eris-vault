"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { characterPortraits, characters } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { makePortrait } from "@/lib/portraits";
import { can } from "@/lib/roles";
import { requireUser } from "@/lib/session";

/**
 * Adding, replacing and removing a character's picture. The player who owns
 * the character can do it at any status; Jay and admins on any character.
 */

export type PortraitResult = { error: string | null; at: number };

const UUID = /^[0-9a-f-]{36}$/i;

/** Saves the picture in `portrait`, or removes it when `remove` is set. */
export async function savePortrait(_prev: PortraitResult, formData: FormData): Promise<PortraitResult> {
  try {
    const viewer = await requireUser();
    const id = String(formData.get("id") ?? "");
    if (!UUID.test(id)) throw new Error("Unknown character");
    const remove = formData.get("remove") === "1";
    let portrait = null;
    if (!remove) {
      const file = formData.get("portrait");
      if (!(file instanceof File) || file.size === 0) throw new Error("Choose a picture first.");
      portrait = await makePortrait(new Uint8Array(await file.arrayBuffer()));
    }

    const changed = await db.transaction(async (tx) => {
      const [c] = await tx
        .select({ id: characters.id, ownerId: characters.ownerId, status: characters.status })
        .from(characters)
        .where(and(eq(characters.id, id), isNull(characters.deletedAt)))
        .for("update");
      if (!c) throw new Error("Unknown character");
      if (!can.editPortrait(viewer, c)) throw new Error("Only the player or Jay can change this picture.");
      if (!portrait) {
        const gone = await tx.delete(characterPortraits).where(eq(characterPortraits.characterId, id)).returning({ id: characterPortraits.characterId });
        return gone.length > 0;
      }
      const row = { contentType: portrait.contentType, size: portrait.data.length, width: portrait.width, height: portrait.height, data: portrait.data, updatedAt: new Date() };
      await tx
        .insert(characterPortraits)
        .values({ characterId: id, ...row })
        .onConflictDoUpdate({ target: characterPortraits.characterId, set: row });
      return true;
    });

    // Every GM and admin action is audited; a player's changes to their own picture are not.
    if (changed && viewer.role !== "player") {
      await writeAudit(viewer, {
        action: portrait ? "portrait.set" : "portrait.removed",
        characterId: id,
        after: portrait ? { width: portrait.width, height: portrait.height, size: portrait.data.length } : null,
      });
    }
    revalidatePath(`/characters/${id}`);
    revalidatePath("/party");
    return { error: null, at: Date.now() };
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e instanceof Error ? e.message : "Something went wrong.").slice(0, 200), at: Date.now() };
  }
}
