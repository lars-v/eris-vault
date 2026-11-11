"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { NOTES_MAX } from "@/lib/limits";
import { can } from "@/lib/roles";
import { requireUser } from "@/lib/session";

/**
 * The free-text notes on a character sheet (an import puts everything it
 * can't place here). The player can edit their own; Jay and admins any.
 */

export type NotesResult = { error: string | null; at: number };

const UUID = /^[0-9a-f-]{36}$/i;

/** Saves the notes; empty text (or `clear`) removes them. */
export async function saveNotes(_prev: NotesResult, formData: FormData): Promise<NotesResult> {
  try {
    const viewer = await requireUser();
    const id = String(formData.get("id") ?? "");
    const raw = formData.get("clear") === "1" ? "" : String(formData.get("notes") ?? "");
    // Keep the player's line breaks; trim only the ends.
    const text = raw.replace(/\r\n/g, "\n").trim();
    if (text.length > NOTES_MAX) throw new Error(`Keep notes to ${NOTES_MAX.toLocaleString("en-US")} characters.`);
    const notes = text || null;
    if (!UUID.test(id)) throw new Error("Unknown character");
    const before = await db.transaction(async (tx) => {
      const [c] = await tx
        .select()
        .from(characters)
        .where(and(eq(characters.id, id), isNull(characters.deletedAt)))
        .for("update");
      if (!c) throw new Error("Unknown character");
      if (!can.editPlayState(viewer, c)) throw new Error("Only the player or Jay can change these notes.");
      if (c.notes === notes) return undefined;
      await tx.update(characters).set({ notes, updatedAt: new Date() }).where(eq(characters.id, id));
      return c.notes;
    });
    // Every GM and admin action is audited; a player's changes to their own notes are not.
    if (before !== undefined && viewer.role !== "player") {
      await writeAudit(viewer, { action: notes ? "notes.edited" : "notes.cleared", characterId: id, before: { notes: before }, after: { notes } });
    }
    revalidatePath(`/characters/${id}`);
    return { error: null, at: Date.now() };
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e instanceof Error ? e.message : "Something went wrong.").slice(0, 200), at: Date.now() };
  }
}
