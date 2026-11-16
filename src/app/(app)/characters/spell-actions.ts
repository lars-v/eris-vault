"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { characterClasses, characters } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { can } from "@/lib/roles";
import { levelFor } from "@/lib/rules/advancement";
import { castsSpells, checkPrepared, knownSpells, spellSlots, type SpellClass } from "@/lib/rules/spells";
import { requireUser } from "@/lib/session";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Locks the character and finds its active spell-casting class. */
async function lockCaster(tx: Tx, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Unknown character");
  const [c] = await tx
    .select()
    .from(characters)
    .where(and(eq(characters.id, id), isNull(characters.deletedAt)))
    .for("update");
  if (!c) throw new Error("Unknown character");
  const [k] = await tx
    .select()
    .from(characterClasses)
    .where(and(eq(characterClasses.characterId, id), eq(characterClasses.active, true)))
    .limit(1);
  if (!k || !castsSpells(k.class)) throw new Error("Only magic-users and clerics cast spells.");
  return { c, cls: k.class as SpellClass, xp: k.xp };
}

/** Saves the day's prepared spells: one form field `slot` per slot, empty when left open. */
async function prepareSpellsImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  const prepared = formData
    .getAll("slot")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const before = await db.transaction(async (tx) => {
    const { c, cls, xp } = await lockCaster(tx, id);
    if (!can.editSpells(viewer, c)) throw new Error("Only the player or Jay can prepare this character's spells.");
    const slots = spellSlots(cls, levelFor(cls, xp).level, c.wis);
    const problem = checkPrepared(cls, slots, knownSpells(cls), prepared);
    if (problem) throw new Error(problem);
    await tx.update(characters).set({ spellsPrepared: prepared, updatedAt: new Date() }).where(eq(characters.id, id));
    return c.spellsPrepared;
  });
  if (viewer.role !== "player") {
    await writeAudit(viewer, { action: "spells.prepared", characterId: id, before: { prepared: before }, after: { prepared } });
  }
  revalidatePath(`/characters/${id}`);
}

export type PrepareResult = { error: string | null; at: number };

/** The prepare picker on the sheet: reports a problem back instead of redirecting. */
export async function savePreparedSpells(_prev: PrepareResult, formData: FormData): Promise<PrepareResult> {
  try {
    await prepareSpellsImpl(formData);
    return { error: null, at: Date.now() };
  } catch (e) {
    unstable_rethrow(e);
    return { error: e instanceof Error ? e.message.slice(0, 200) : "Something went wrong.", at: Date.now() };
  }
}
