"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { characterClasses, characters, inventory } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { can } from "@/lib/roles";
import { checkAddCatalog, checkCustomItem, checkQuantity, ITEM_MAX_QUANTITY, kindFor } from "@/lib/rules/equipment";
import { requireUser, type CurrentUser } from "@/lib/session";

/**
 * Editing gear on the character sheet: add from the price list (WW p. 17),
 * add other items, change a quantity, remove. The owner can edit their own
 * characters; Jay and admins can edit any (can.editGear). Coins don't change.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Item = typeof inventory.$inferSelect;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * What a gear form gets back: the rule problem to show next to it, or null.
 * `at` changes on every reply so a form can tell a fresh success apart.
 */
export type GearResult = { error: string | null; at: number };

async function guard(formData: FormData, impl: (fd: FormData) => Promise<void>): Promise<GearResult> {
  try {
    await impl(formData);
    return { error: null, at: Date.now() };
  } catch (e) {
    unstable_rethrow(e);
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { error: msg.slice(0, 200), at: Date.now() };
  }
}

/** Locks the character row and checks the viewer may change its gear. */
async function lockForGear(tx: Tx, viewer: CurrentUser, id: string) {
  if (!UUID.test(id)) throw new Error("Unknown character");
  const [c] = await tx
    .select()
    .from(characters)
    .where(and(eq(characters.id, id), isNull(characters.deletedAt)))
    .for("update");
  if (!c) throw new Error("Unknown character");
  if (!can.editGear(viewer, c)) throw new Error("Only the player or Jay can change this character's gear.");
  return c;
}

async function findItem(tx: Tx, id: string, itemId: string) {
  if (!UUID.test(itemId)) throw new Error("That item isn't on this character.");
  const [item] = await tx
    .select()
    .from(inventory)
    .where(and(eq(inventory.id, itemId), eq(inventory.characterId, id)));
  if (!item) throw new Error("That item isn't on this character.");
  return item;
}

const snapshot = (i: Pick<Item, "name" | "quantity" | "encUnits" | "catalogKey" | "isMagic">) => ({
  name: i.name,
  quantity: i.quantity,
  encUnits: i.encUnits,
  catalogKey: i.catalogKey,
  isMagic: i.isMagic,
});

/** Every GM and admin action is audited; a player's changes to their own gear are not. */
async function audit(viewer: CurrentUser, action: string, characterId: string, before: unknown, after: unknown) {
  if (viewer.role === "player") return;
  await writeAudit(viewer, { action, characterId, before, after });
}

function done(id: string) {
  revalidatePath(`/characters/${id}`);
  revalidatePath(`/characters/${id}/build`);
}

function wholeNumber(fd: FormData, key: string): number {
  const raw = str(fd, key);
  return raw === "" ? NaN : Number(raw);
}

/** Adds an item from the price list. If the same plain item is already carried, its quantity goes up instead. */
async function addCatalogItemImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  const result = await db.transaction(async (tx) => {
    const c = await lockForGear(tx, viewer, id);
    const [k] = await tx
      .select({ cls: characterClasses.class })
      .from(characterClasses)
      .where(and(eq(characterClasses.characterId, id), eq(characterClasses.active, true)))
      .limit(1);
    const checked = checkAddCatalog(
      k ? { cls: k.cls, race: c.race, int: c.int } : null,
      str(formData, "key"),
      wholeNumber(formData, "quantity"),
      can.approve(viewer),
    );
    if (typeof checked === "string") throw new Error(checked);
    const { item, quantity } = checked;

    const [same] = await tx
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.characterId, id),
          eq(inventory.catalogKey, item.key),
          eq(inventory.isMagic, false),
          eq(inventory.location, "carried"),
        ),
      )
      .limit(1);
    if (same) {
      const total = same.quantity + quantity;
      if (total > ITEM_MAX_QUANTITY) throw new Error(`That would make ${total} ${item.name}; the most is ${ITEM_MAX_QUANTITY}.`);
      await tx.update(inventory).set({ quantity: total }).where(eq(inventory.id, same.id));
      return { before: snapshot(same), after: snapshot({ ...same, quantity: total }) };
    }
    const row = {
      characterId: id,
      name: item.name,
      kind: kindFor(item.category),
      quantity,
      encUnits: item.enc,
      catalogKey: item.key,
      location: "carried" as const,
    };
    await tx.insert(inventory).values(row);
    return { before: null, after: snapshot({ ...row, isMagic: false }) };
  });
  await audit(viewer, "gear.added", id, result.before, result.after);
  done(id);
}

/** Adds an item that isn't on the price list. A blank weight stays unknown (never guessed). */
async function addCustomItemImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  const unitsRaw = str(formData, "units");
  const after = await db.transaction(async (tx) => {
    await lockForGear(tx, viewer, id);
    const checked = checkCustomItem(
      {
        name: str(formData, "name"),
        quantity: wholeNumber(formData, "quantity"),
        units: unitsRaw === "" ? null : Number(unitsRaw),
        isMagic: formData.get("magic") === "on",
      },
      can.approve(viewer),
    );
    if (typeof checked === "string") throw new Error(checked);
    const row = {
      characterId: id,
      name: checked.name,
      kind: "Gear",
      quantity: checked.quantity,
      encUnits: checked.units,
      isMagic: checked.isMagic,
      catalogKey: null,
      location: "carried" as const,
    };
    await tx.insert(inventory).values(row);
    return snapshot(row);
  });
  await audit(viewer, "gear.added", id, null, after);
  done(id);
}

/** Sets a quantity, or steps it by one (`step` = "1" or "-1"). Stepping below 1 is refused; use Remove. */
async function setItemQuantityImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  const result = await db.transaction(async (tx) => {
    await lockForGear(tx, viewer, id);
    const item = await findItem(tx, id, str(formData, "itemId"));
    const step = str(formData, "step");
    const wanted = step === "1" || step === "-1" ? item.quantity + Number(step) : wholeNumber(formData, "quantity");
    const quantity = checkQuantity(wanted);
    if (typeof quantity === "string") throw new Error(quantity);
    if (quantity === item.quantity) return null;
    await tx.update(inventory).set({ quantity }).where(eq(inventory.id, item.id));
    return { before: snapshot(item), after: snapshot({ ...item, quantity }) };
  });
  if (result) await audit(viewer, "gear.quantity", id, result.before, result.after);
  done(id);
}

async function deleteItemImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  const before = await db.transaction(async (tx) => {
    await lockForGear(tx, viewer, id);
    const item = await findItem(tx, id, str(formData, "itemId"));
    await tx.delete(inventory).where(eq(inventory.id, item.id));
    return snapshot(item);
  });
  await audit(viewer, "gear.removed", id, before, null);
  done(id);
}

export async function addCatalogItem(_prev: GearResult, formData: FormData): Promise<GearResult> {
  return guard(formData, addCatalogItemImpl);
}

export async function addCustomItem(_prev: GearResult, formData: FormData): Promise<GearResult> {
  return guard(formData, addCustomItemImpl);
}

export async function setItemQuantity(_prev: GearResult, formData: FormData): Promise<GearResult> {
  return guard(formData, setItemQuantityImpl);
}

export async function deleteItem(_prev: GearResult, formData: FormData): Promise<GearResult> {
  return guard(formData, deleteItemImpl);
}
