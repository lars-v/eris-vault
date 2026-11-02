"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { characterClasses, characters } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { can } from "@/lib/roles";
import { levelFor } from "@/lib/rules/advancement";
import { castsSpells, checkPrepared, knownSpells, spell, spellsFor, spellSlots, type SpellClass } from "@/lib/rules/spells";
import { requireStaff, requireUser } from "@/lib/session";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Rule problems come back to the character page as `?error=`. */
async function guard(formData: FormData, impl: (fd: FormData) => Promise<void>) {
  try {
    await impl(formData);
  } catch (e) {
    unstable_rethrow(e);
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    redirect(`/characters/${encodeURIComponent(str(formData, "id"))}?error=${encodeURIComponent(msg.slice(0, 200))}`);
  }
}

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
    if (!can.editPlayState(viewer, c)) throw new Error("Only the player or Jay can prepare this character's spells.");
    const slots = spellSlots(cls, levelFor(cls, xp).level, c.wis);
    const problem = checkPrepared(cls, slots, knownSpells(cls, c.spellsKnown), prepared);
    if (problem) throw new Error(problem);
    await tx.update(characters).set({ spellsPrepared: prepared, updatedAt: new Date() }).where(eq(characters.id, id));
    return c.spellsPrepared;
  });
  if (viewer.role !== "player") {
    await writeAudit(viewer, { action: "spells.prepared", characterId: id, before: { prepared: before }, after: { prepared } });
  }
  revalidatePath(`/characters/${id}`);
}

/**
 * Jay records a book or scroll the character now holds (WW p. 25): a whole
 * spell level ("level:2") or one spell (a limited scroll, or a scroll an elf studied).
 */
async function recordSpellsImpl(formData: FormData) {
  const viewer = await requireStaff();
  const id = str(formData, "id");
  const add = str(formData, "add");
  const result = await db.transaction(async (tx) => {
    const { c, cls } = await lockCaster(tx, id);
    let keys: string[];
    const whole = add.match(/^level:(\d)$/);
    if (whole) {
      keys = spellsFor(cls, Number(whole[1])).map((s) => s.key);
      if (keys.length === 0) throw new Error("No spells at that level for this class.");
    } else {
      const s = spell(add);
      if (!s || s.cls !== cls) throw new Error("Choose a spell from this class's list.");
      keys = [s.key];
    }
    const next = [...new Set([...c.spellsKnown, ...keys])];
    await tx.update(characters).set({ spellsKnown: next, updatedAt: new Date() }).where(eq(characters.id, id));
    return { before: c.spellsKnown, after: next };
  });
  await writeAudit(viewer, { action: "spells.recorded", characterId: id, before: { known: result.before }, after: { known: result.after, added: add } });
  revalidatePath(`/characters/${id}`);
}

/** Jay takes back a recorded spell; it also leaves any slot it was prepared in. */
async function forgetSpellImpl(formData: FormData) {
  const viewer = await requireStaff();
  const id = str(formData, "id");
  const key = str(formData, "key");
  const result = await db.transaction(async (tx) => {
    const { c } = await lockCaster(tx, id);
    if (!c.spellsKnown.includes(key)) throw new Error("That spell wasn't recorded on this character.");
    const known = c.spellsKnown.filter((k) => k !== key);
    const prepared = c.spellsPrepared.filter((k) => k !== key);
    await tx.update(characters).set({ spellsKnown: known, spellsPrepared: prepared, updatedAt: new Date() }).where(eq(characters.id, id));
    return { before: { known: c.spellsKnown, prepared: c.spellsPrepared }, after: { known, prepared } };
  });
  await writeAudit(viewer, { action: "spells.forgotten", characterId: id, ...result });
  revalidatePath(`/characters/${id}`);
}

export async function prepareSpells(formData: FormData) {
  return guard(formData, prepareSpellsImpl);
}

export async function recordSpells(formData: FormData) {
  return guard(formData, recordSpellsImpl);
}

export async function forgetSpell(formData: FormData) {
  return guard(formData, forgetSpellImpl);
}
