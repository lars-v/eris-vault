"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { characterClasses, characters, inventory, storedSpellEvents } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { can } from "@/lib/roles";
import { playStateOpen } from "@/lib/rules/overrides";
import { spell } from "@/lib/rules/spells";
import {
  checkLoad,
  checkRelease,
  checkVoid,
  slotStates,
  STAFF_CATALOG_KEY,
  staffCapacity,
  type StaffAction,
} from "@/lib/rules/staff";
import { requireUser, type CurrentUser } from "@/lib/session";

/**
 * The spell staff or wand on the character sheet (WW pp. 5, 7; src/lib/rules/staff.ts).
 *
 * - Set focus: which carried staff or wand stores spells. The owner may pick a
 *   price-list staff; only Jay and admins may pick any other item (a found
 *   magic staff, a wand), since the vault can't tell a wand from its name.
 * - Load and release: the owner on an approved character, Jay and admins on
 *   submitted ones too (the same as hit points). Void: Jay and admins only.
 *
 * Each runs in one transaction that locks the character row, reads the slot's
 * latest event, checks it, inserts a new event and writes audit_log. Events
 * are insert-only and never go to the public rolls log.
 */

export type StaffResult = { error: string | null; at: number };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;

async function guard(formData: FormData, impl: (fd: FormData) => Promise<void>): Promise<StaffResult> {
  try {
    await impl(formData);
    return { error: null, at: Date.now() };
  } catch (e) {
    unstable_rethrow(e);
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { error: msg.slice(0, 200), at: Date.now() };
  }
}

function refresh(id: string) {
  revalidatePath(`/characters/${id}`);
  revalidatePath("/party");
}

/** Locks the character and reads what the staff checks need. */
async function loadStaff(tx: Tx, id: string) {
  if (!UUID.test(id)) throw new Error("Unknown character");
  const [c] = await tx
    .select()
    .from(characters)
    .where(and(eq(characters.id, id), isNull(characters.deletedAt)))
    .for("update");
  if (!c) throw new Error("Unknown character");
  const [classes, items, events] = await Promise.all([
    tx.select({ class: characterClasses.class }).from(characterClasses).where(eq(characterClasses.characterId, id)),
    tx.select().from(inventory).where(eq(inventory.characterId, id)),
    tx.select().from(storedSpellEvents).where(eq(storedSpellEvents.characterId, id)),
  ]);
  const capacity = staffCapacity(
    classes.map((k) => k.class),
    c.int,
  );
  const focus = items.find((i) => i.isSpellFocus) ?? null;
  return { c, capacity, items, focus, states: slotStates(events) };
}

function checkSlotAccess(viewer: CurrentUser, c: typeof characters.$inferSelect) {
  if (!can.useSpellStaff(viewer, c)) throw new Error("Only the player or Jay can use this character's staff.");
  const staff = can.approve(viewer);
  if (!playStateOpen(c.status, staff)) {
    throw new Error(
      staff
        ? "The staff can be used once the character is submitted."
        : "You can use the staff once Jay approves the character.",
    );
  }
}

async function record(
  tx: Tx,
  viewer: CurrentUser,
  e: { characterId: string; inventoryId: string | null; slot: number; spell: string; action: StaffAction; note?: string | null },
) {
  await tx.insert(storedSpellEvents).values({
    characterId: e.characterId,
    inventoryId: e.inventoryId,
    slot: e.slot,
    spell: e.spell,
    action: e.action,
    actorId: viewer.userId,
    note: e.note ?? null,
  });
  await writeAudit(
    viewer,
    {
      action: `staff.${e.action}`,
      characterId: e.characterId,
      after: { slot: e.slot, spell: e.spell, spellName: spell(e.spell)?.name ?? null, inventoryId: e.inventoryId, note: e.note ?? null },
    },
    tx,
  );
}

const slotOf = (fd: FormData) => Number(str(fd, "slot"));

async function loadImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  const slot = slotOf(formData);
  const key = str(formData, "spell");
  await db.transaction(async (tx) => {
    const { c, capacity, focus, states } = await loadStaff(tx, id);
    checkSlotAccess(viewer, c);
    const problem = checkLoad({ states, capacity, slot, spell: key, hasFocus: focus !== null, spellbook: c.spellbook });
    if (problem) throw new Error(problem);
    await record(tx, viewer, { characterId: id, inventoryId: focus!.id, slot, spell: key, action: "load" });
  });
  refresh(id);
}

async function releaseImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  const slot = slotOf(formData);
  await db.transaction(async (tx) => {
    const { c, states } = await loadStaff(tx, id);
    checkSlotAccess(viewer, c);
    const problem = checkRelease(states, slot);
    if (problem) throw new Error(problem);
    const s = states.find((x) => x.slot === slot)!;
    await record(tx, viewer, { characterId: id, inventoryId: s.inventoryId, slot, spell: s.spell!, action: "release" });
  });
  refresh(id);
}

async function voidImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  const slot = slotOf(formData);
  const note = str(formData, "note");
  await db.transaction(async (tx) => {
    const { states } = await loadStaff(tx, id);
    if (!can.voidStoredSpell(viewer)) throw new Error("Only Jay can void a stored spell.");
    const problem = checkVoid(states, slot, note);
    if (problem) throw new Error(problem);
    const s = states.find((x) => x.slot === slot)!;
    await record(tx, viewer, { characterId: id, inventoryId: s.inventoryId, slot, spell: s.spell!, action: "void", note });
  });
  refresh(id);
}

/** Sets which item is the staff or wand (`itemId`), or clears it (`itemId` empty). */
async function setFocusImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  const itemId = str(formData, "itemId");
  await db.transaction(async (tx) => {
    const { c, capacity, items, focus } = await loadStaff(tx, id);
    if (!can.editGear(viewer, c)) throw new Error("Only the player or Jay can choose this character's staff.");
    const staff = can.approve(viewer);
    let next: (typeof items)[number] | null = null;
    if (itemId) {
      next = items.find((i) => i.id === itemId) ?? null;
      if (!next) throw new Error("That item isn't on this character.");
      if (capacity === 0) throw new Error("Only a magic-user with an Intelligence bonus (15+) can store spells in a staff (WW p. 7).");
      if (next.catalogKey !== STAFF_CATALOG_KEY && !staff) {
        throw new Error("Only Jay can set an item other than a price-list staff as the spell focus (a wand or a found staff).");
      }
    }
    if ((focus?.id ?? null) === (next?.id ?? null)) return;
    // Clear first: the unique index allows one focus item per character.
    if (focus) await tx.update(inventory).set({ isSpellFocus: null }).where(eq(inventory.id, focus.id));
    if (next) await tx.update(inventory).set({ isSpellFocus: true }).where(eq(inventory.id, next.id));
    await writeAudit(
      viewer,
      {
        action: "staff.focus",
        characterId: id,
        before: focus ? { itemId: focus.id, name: focus.name } : null,
        after: next ? { itemId: next.id, name: next.name } : null,
      },
      tx,
    );
  });
  refresh(id);
}

export async function loadStoredSpell(_prev: StaffResult, formData: FormData): Promise<StaffResult> {
  return guard(formData, loadImpl);
}

export async function releaseStoredSpell(_prev: StaffResult, formData: FormData): Promise<StaffResult> {
  return guard(formData, releaseImpl);
}

export async function voidStoredSpell(_prev: StaffResult, formData: FormData): Promise<StaffResult> {
  return guard(formData, voidImpl);
}

export async function setSpellFocus(_prev: StaffResult, formData: FormData): Promise<StaffResult> {
  return guard(formData, setFocusImpl);
}
