"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  characterClasses,
  characters,
  inventory,
  rollGrants,
  rolls,
  sheetUploads,
  type Alignment,
  type CharacterClass,
  type Race,
  type RollPurpose,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { can } from "@/lib/roles";
import { ABILITIES, abilityModifier, type Ability } from "@/lib/rules/abilities";
import { assignScores, isValidIdentity } from "@/lib/rules/creation";
import { rollAbilitySets, rollFirstLevelHp, rollStartingGold, type Roll } from "@/lib/rules/dice";
import { catalogItem, classAllows, randomKitKeys } from "@/lib/rules/equipment";
import { changedFromSheet, importFlags } from "@/lib/rules/import";
import { draftFromFields, matchCatalog, readPdfFields, SHEET_MAX_BYTES, sniffSheetType } from "@/lib/sheets";
import { requireStaff, requireUser, type CurrentUser } from "@/lib/session";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function refresh(id: string) {
  revalidatePath(`/characters/${id}`);
  revalidatePath(`/characters/${id}/build`);
  revalidatePath("/party");
  revalidatePath("/rolls");
  revalidatePath("/gm");
}

/** Every die goes in the insert-only rolls table before it touches a character. */
async function recordRoll(tx: Tx, viewer: CurrentUser, characterId: string, purpose: RollPurpose, roll: Roll) {
  const [row] = await tx
    .insert(rolls)
    .values({ userId: viewer.userId, characterId, purpose, formula: roll.formula, dice: roll.dice, totals: roll.totals })
    .returning({ id: rolls.id });
  return row.id;
}

/** Locks the character row and checks the viewer may change its core stats. */
async function lockEditable(tx: Tx, viewer: CurrentUser, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Unknown character");
  const [c] = await tx
    .select()
    .from(characters)
    .where(and(eq(characters.id, id), isNull(characters.deletedAt)))
    .for("update");
  if (!c) throw new Error("Unknown character");
  if (!can.editCoreStats(viewer, c)) throw new Error("Only the player can change a draft; Jay can change any character.");
  // Imported characters have no app rolls to build on, so the wizard stays shut for players.
  if (c.source !== "app" && !can.approve(viewer)) {
    throw new Error("This character came from a sheet. Ask Jay to change it, or delete it and upload the sheet again.");
  }
  return c;
}

async function activeClass(tx: Tx, id: string): Promise<CharacterClass | null> {
  const [k] = await tx
    .select({ cls: characterClasses.class })
    .from(characterClasses)
    .where(and(eq(characterClasses.characterId, id), eq(characterClasses.active, true)))
    .limit(1);
  return k?.cls ?? null;
}


/**
 * Runs a wizard step. Rule problems come back to the build page (or `back`)
 * as a message instead of an error screen.
 */
async function guard(formData: FormData, impl: (fd: FormData) => Promise<void>, back?: string) {
  try {
    await impl(formData);
  } catch (e) {
    unstable_rethrow(e);
    const id = str(formData, "id");
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    redirect(`${back ?? `/characters/${encodeURIComponent(id)}/build`}?error=${encodeURIComponent(msg.slice(0, 200))}`);
  }
}

/* ---------- Creation ---------- */

export async function startCharacter() {
  const viewer = await requireUser();
  if (!can.createCharacter(viewer)) throw new Error("Not allowed");
  const id = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(characters)
      .values({ ownerId: viewer.userId, name: "Unnamed adventurer", status: "draft" })
      .returning({ id: characters.id });
    const rollId = await recordRoll(tx, viewer, c.id, "abilities", rollAbilitySets());
    await tx.update(characters).set({ abilityRollId: rollId }).where(eq(characters.id, c.id));
    return c.id;
  });
  await writeAudit(viewer, { action: "character.started", characterId: id });
  refresh(id);
  redirect(`/characters/${id}/build`);
}

async function saveAbilitiesImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  await db.transaction(async (tx) => {
    const c = await lockEditable(tx, viewer, id);
    if (c.hpRollId) throw new Error("Abilities are fixed once hit points are rolled.");
    if (!c.abilityRollId) throw new Error("Roll abilities first.");
    const [roll] = await tx.select().from(rolls).where(eq(rolls.id, c.abilityRollId));
    const picks = Object.fromEntries(ABILITIES.map((ab) => [ab, Number(formData.get(ab))])) as Record<Ability, number>;
    const scores = assignScores(roll.totals, picks);
    if (typeof scores === "string") throw new Error(scores);
    await tx.update(characters).set({ ...scores, updatedAt: new Date() }).where(eq(characters.id, id));
  });
  refresh(id);
}

async function saveIdentityImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  const name = str(formData, "name").slice(0, 60);
  const race = str(formData, "race") as Race;
  const cls = str(formData, "cls") as CharacterClass;
  const alignment = str(formData, "alignment") as Alignment;
  const deity = str(formData, "deity").slice(0, 60) || null;
  if (!name) throw new Error("Give the character a name.");
  const problem = isValidIdentity(race, cls, alignment);
  if (problem) throw new Error(problem);

  await db.transaction(async (tx) => {
    const c = await lockEditable(tx, viewer, id);
    const current = await activeClass(tx, id);
    if (c.hpRollId && (c.race !== race || current !== cls)) {
      throw new Error("Race and class are fixed once hit points are rolled.");
    }
    await tx.update(characters).set({ name, race, alignment, deity, updatedAt: new Date() }).where(eq(characters.id, id));
    if (current !== cls) {
      // Elves begin in one of their two classes (WW p. 10); the other record starts when they switch.
      await tx.delete(characterClasses).where(eq(characterClasses.characterId, id));
      await tx.insert(characterClasses).values({ characterId: id, class: cls, xp: 0, active: true });
    }
  });
  refresh(id);
}

async function doHpRoll(tx: Tx, viewer: CurrentUser, c: typeof characters.$inferSelect) {
  const cls = await activeClass(tx, c.id);
  if (!cls || c.con === null) throw new Error("Choose a class and assign Constitution before rolling hit points.");
  const roll = rollFirstLevelHp(cls, abilityModifier(c.con));
  const rollId = await recordRoll(tx, viewer, c.id, "hp", roll);
  await tx
    .update(characters)
    .set({ hpRollId: rollId, hpMax: roll.hp, hpCurrent: roll.hp, updatedAt: new Date() })
    .where(eq(characters.id, c.id));
}

async function doGoldRoll(tx: Tx, viewer: CurrentUser, c: typeof characters.$inferSelect) {
  const roll = rollStartingGold();
  const rollId = await recordRoll(tx, viewer, c.id, "gold", roll);
  await tx
    .update(characters)
    .set({ goldRollId: rollId, coinsGp: roll.gold, updatedAt: new Date() })
    .where(eq(characters.id, c.id));
}

async function rollHitPointsImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  await db.transaction(async (tx) => {
    const c = await lockEditable(tx, viewer, id);
    if (c.hpRollId) throw new Error("Hit points are already rolled. Jay can grant a re-roll.");
    await doHpRoll(tx, viewer, c);
  });
  refresh(id);
}

async function rollGoldImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  await db.transaction(async (tx) => {
    const c = await lockEditable(tx, viewer, id);
    if (c.goldRollId) throw new Error("Starting gold is already rolled. Jay can grant a re-roll.");
    await doGoldRoll(tx, viewer, c);
  });
  refresh(id);
}

/** Spends a re-roll Jay or the admin granted. The earlier roll stays in the log. */
async function spendRollGrantImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  const grantId = str(formData, "grantId");
  await db.transaction(async (tx) => {
    const c = await lockEditable(tx, viewer, id);
    const [grant] = await tx
      .select()
      .from(rollGrants)
      .where(and(eq(rollGrants.id, grantId), eq(rollGrants.characterId, id), isNull(rollGrants.usedAt)))
      .for("update");
    if (!grant) throw new Error("That re-roll was already used or doesn't exist.");
    let rollId: string;
    if (grant.purpose === "abilities") {
      rollId = await recordRoll(tx, viewer, id, "abilities", rollAbilitySets());
      // New sets must be arranged again, and hit points depend on Constitution, so they go too.
      await tx
        .update(characters)
        .set({
          abilityRollId: rollId,
          str: null,
          int: null,
          wis: null,
          dex: null,
          con: null,
          cha: null,
          hpRollId: null,
          hpMax: null,
          hpCurrent: null,
          updatedAt: new Date(),
        })
        .where(eq(characters.id, id));
    } else if (grant.purpose === "hp") {
      await doHpRoll(tx, viewer, c);
      const [after] = await tx.select({ hpRollId: characters.hpRollId }).from(characters).where(eq(characters.id, id));
      rollId = after.hpRollId!;
    } else {
      await doGoldRoll(tx, viewer, c);
      const [after] = await tx.select({ goldRollId: characters.goldRollId }).from(characters).where(eq(characters.id, id));
      rollId = after.goldRollId!;
    }
    await tx.update(rollGrants).set({ usedRollId: rollId, usedAt: new Date() }).where(eq(rollGrants.id, grantId));
  });
  refresh(id);
}

async function addItemImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  const item = catalogItem(str(formData, "key"));
  const quantity = Math.max(1, Math.min(20, Math.floor(Number(formData.get("quantity")) || 1)));
  if (!item) throw new Error("That item isn't on the price list.");
  await db.transaction(async (tx) => {
    const c = await lockEditable(tx, viewer, id);
    const cls = await activeClass(tx, id);
    if (!cls) throw new Error("Choose a class first, so class limits can be checked.");
    const allowed = classAllows({ cls, race: c.race, int: c.int }, item);
    if (!allowed.ok) throw new Error(allowed.why);
    await tx.insert(inventory).values({
      characterId: id,
      name: item.name,
      kind: item.category === "weapon" ? "Weapon" : item.category === "armor" ? "Armor" : "Gear",
      quantity,
      encUnits: item.enc,
      catalogKey: item.key,
      location: "carried",
    });
  });
  refresh(id);
}

/** Replaces the kit with a random basic kit that fits the class (see randomKitKeys). Not a roll: it isn't logged. */
async function randomKitImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  await db.transaction(async (tx) => {
    const c = await lockEditable(tx, viewer, id);
    const cls = await activeClass(tx, id);
    if (!cls) throw new Error("Choose a class first, so the kit fits it.");
    const keys = randomKitKeys({ cls, race: c.race, int: c.int });
    await tx.delete(inventory).where(eq(inventory.characterId, id));
    await tx.insert(inventory).values(
      keys.map((key) => {
        const item = catalogItem(key)!;
        return {
          characterId: id,
          name: item.name,
          kind: item.category === "weapon" ? "Weapon" : item.category === "armor" ? "Armor" : "Gear",
          quantity: 1,
          encUnits: item.enc,
          catalogKey: item.key,
          location: "carried" as const,
        };
      }),
    );
  });
  refresh(id);
}

async function removeItemImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  const itemId = str(formData, "itemId");
  await db.transaction(async (tx) => {
    await lockEditable(tx, viewer, id);
    await tx.delete(inventory).where(and(eq(inventory.id, itemId), eq(inventory.characterId, id)));
  });
  refresh(id);
}

async function submitCharacterImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  await db.transaction(async (tx) => {
    const c = await lockEditable(tx, viewer, id);
    if (c.status !== "draft") throw new Error("Only drafts can be sent to Jay.");
    const cls = await activeClass(tx, id);
    const missing = [
      ABILITIES.some((ab) => c[ab] === null) && "abilities",
      (!c.race || !cls || !c.alignment) && "race, class and alignment",
      !c.hpRollId && "hit points",
      !c.goldRollId && "starting gold",
    ].filter(Boolean);
    if (missing.length) throw new Error(`Still needed: ${missing.join(", ")}.`);
    const items = await tx.select({ key: inventory.catalogKey, name: inventory.name }).from(inventory).where(eq(inventory.characterId, id));
    for (const it of items) {
      const entry = it.key ? catalogItem(it.key) : undefined;
      const allowed = entry && cls ? classAllows({ cls, race: c.race, int: c.int }, entry) : { ok: true as const };
      if (!allowed.ok) throw new Error(`${it.name}: ${allowed.why}`);
    }
    await tx.update(characters).set({ status: "submitted", updatedAt: new Date() }).where(eq(characters.id, id));
  });
  await writeAudit(viewer, { action: "character.submitted", characterId: id });
  refresh(id);
  redirect(`/characters/${id}`);
}

async function deleteDraftImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  await db.transaction(async (tx) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Unknown character");
    const [c] = await tx
      .select()
      .from(characters)
      .where(and(eq(characters.id, id), isNull(characters.deletedAt)))
      .for("update");
    if (!c) throw new Error("Unknown character");
    if (!can.deleteCharacter(viewer, c)) throw new Error("Players can delete a character only before Jay approves it.");
    // Soft delete: the character's rolls stay visible in the roll log.
    await tx.update(characters).set({ deletedAt: new Date() }).where(eq(characters.id, id));
  });
  await writeAudit(viewer, { action: "character.deleted", characterId: id });
  refresh(id);
  redirect("/party");
}

export async function saveAbilities(formData: FormData) {
  return guard(formData, saveAbilitiesImpl);
}

export async function saveIdentity(formData: FormData) {
  return guard(formData, saveIdentityImpl);
}

export async function rollHitPoints(formData: FormData) {
  return guard(formData, rollHitPointsImpl);
}

export async function rollGold(formData: FormData) {
  return guard(formData, rollGoldImpl);
}

export async function spendRollGrant(formData: FormData) {
  return guard(formData, spendRollGrantImpl);
}

export async function addItem(formData: FormData) {
  return guard(formData, addItemImpl);
}

export async function randomKit(formData: FormData) {
  return guard(formData, randomKitImpl);
}

export async function removeItem(formData: FormData) {
  return guard(formData, removeItemImpl);
}

export async function submitCharacter(formData: FormData) {
  return guard(formData, submitCharacterImpl);
}

export async function deleteDraft(formData: FormData) {
  return guard(formData, deleteDraftImpl);
}

/** Same delete from a party card; problems come back to the party page. */
export async function deleteFromParty(formData: FormData) {
  return guard(formData, deleteDraftImpl, "/party");
}

/* ---------- Bringing a character in from a sheet ---------- */

async function uploadSheetImpl(formData: FormData) {
  const viewer = await requireUser();
  if (!can.createCharacter(viewer)) throw new Error("Not allowed");
  const file = formData.get("sheet");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose your character sheet file first.");
  if (file.size > SHEET_MAX_BYTES) throw new Error("That file is over 8 MB. Try a smaller scan or photo.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffSheetType(bytes);
  if (!type) throw new Error("Upload a PDF, PNG or JPEG of your sheet.");
  const fields = type === "application/pdf" ? await readPdfFields(bytes) : {};
  const [row] = await db
    .insert(sheetUploads)
    .values({
      ownerId: viewer.userId,
      filename: file.name.slice(0, 120) || "sheet",
      contentType: type,
      size: bytes.length,
      data: Buffer.from(bytes),
      fields,
    })
    .returning({ id: sheetUploads.id });
  redirect(`/characters/import/${row.id}`);
}

function wholeNumber(fd: FormData, key: string, label: string, min: number, max: number) {
  const raw = str(fd, key);
  const v = Number(raw);
  if (raw === "" || !Number.isInteger(v) || v < min || v > max) throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  return v;
}

/**
 * Creates the character from the reviewed sheet and sends it straight to Jay.
 * No dice are rolled or logged: the numbers are the sheet's, Jay checks them
 * against the uploaded file, and every mismatch with the books is a flag.
 */
async function sendImportImpl(formData: FormData) {
  const viewer = await requireUser();
  if (!can.createCharacter(viewer)) throw new Error("Not allowed");
  const uploadId = str(formData, "uploadId");
  if (!/^[0-9a-f-]{36}$/i.test(uploadId)) throw new Error("Unknown upload");

  const name = str(formData, "name").slice(0, 60);
  if (!name) throw new Error("Give the character a name.");
  const race = str(formData, "race") as Race;
  const cls = str(formData, "cls") as CharacterClass;
  const alignment = str(formData, "alignment") as Alignment;
  if (!["human", "dwarf", "elf", "halfling"].includes(race)) throw new Error("Choose one of the four races.");
  if (!["fighting-man", "magic-user", "cleric", "thief"].includes(cls)) throw new Error("Choose a class.");
  if (!["lawful", "neutral", "chaotic"].includes(alignment)) throw new Error("Choose an alignment.");
  const deity = str(formData, "deity").slice(0, 60) || null;
  const scores = Object.fromEntries(
    ABILITIES.map((ab) => [ab, wholeNumber(formData, ab, ab.toUpperCase(), 3, 18)]),
  ) as Record<Ability, number>;
  const xp = wholeNumber(formData, "xp", "XP", 0, 10_000_000);
  const hpMax = wholeNumber(formData, "hpMax", "Maximum hit points", 1, 999);
  const hpCurrent = wholeNumber(formData, "hpCurrent", "Current hit points", -99, 999);
  const coinsGp = wholeNumber(formData, "coinsGp", "Gold", -1_000_000, 10_000_000);
  const coinsSp = wholeNumber(formData, "coinsSp", "Silver", 0, 10_000_000);
  const coinsCp = wholeNumber(formData, "coinsCp", "Copper", 0, 10_000_000);
  const notes = str(formData, "notes").slice(0, 4000) || null;

  const items: Omit<typeof inventory.$inferInsert, "characterId">[] = [];
  const rows = Math.min(80, Math.max(0, Math.floor(Number(formData.get("itemRows")) || 0)));
  for (let i = 0; i < rows; i++) {
    const itemName = str(formData, `item${i}`).slice(0, 80);
    if (!itemName) continue;
    const units = str(formData, `units${i}`);
    const encUnits = units === "" ? null : wholeNumber(formData, `units${i}`, `Units for ${itemName}`, 0, 99);
    const isMagic = formData.get(`magic${i}`) === "on";
    const bonus = itemName.match(/\+(\d)\b/);
    const entry = matchCatalog(itemName);
    items.push({
      name: itemName,
      kind: entry?.category === "weapon" ? "Weapon" : entry?.category === "armor" ? "Armor" : "Gear",
      quantity: 1,
      encUnits,
      catalogKey: entry?.key ?? null,
      isMagic,
      magicBonus: isMagic && bonus ? Number(bonus[1]) : null,
      location: "carried" as const,
    });
  }

  const done = await db.transaction(async (tx) => {
    const [upload] = await tx
      .select()
      .from(sheetUploads)
      .where(and(eq(sheetUploads.id, uploadId), eq(sheetUploads.ownerId, viewer.userId)))
      .for("update");
    if (!upload) throw new Error("Unknown upload");
    if (upload.characterId) throw new Error("This sheet was already sent to Jay.");

    const sheet = draftFromFields(upload.fields);
    const flags = importFlags({ race, cls, alignment, xp, scores, hpCurrent, hpMax, coinsGp, items }, sheet.written);
    const changed = changedFromSheet([
      { label: "Name", sheet: sheet.name, entered: name },
      { label: "Race", sheet: sheet.race, entered: race },
      { label: "Class", sheet: sheet.cls, entered: cls },
      { label: "Alignment", sheet: sheet.alignment, entered: alignment },
      { label: "XP", sheet: sheet.xp, entered: xp },
      ...ABILITIES.map((ab) => ({ label: ab.toUpperCase(), sheet: sheet.scores[ab], entered: scores[ab] })),
      { label: "Maximum hit points", sheet: sheet.hpMax, entered: hpMax },
      { label: "Current hit points", sheet: sheet.hpCurrent, entered: hpCurrent },
      { label: "Gold", sheet: sheet.coinsGp, entered: coinsGp },
    ]);
    if (changed) flags.push(changed);
    if (Object.keys(upload.fields).length === 0) {
      flags.push({
        title: "Typed in by the player",
        body: "The uploaded file had no form fields to read, so every number was entered by hand. Check them against the file.",
        source: "Uploaded sheet",
      });
    }

    const [c] = await tx
      .insert(characters)
      .values({
        ownerId: viewer.userId,
        name,
        race,
        alignment,
        status: "submitted",
        ...scores,
        hpCurrent,
        hpMax,
        coinsGp,
        coinsSp,
        coinsCp,
        deity,
        notes,
        source: "sheet-import",
        importFlags: flags,
      })
      .returning({ id: characters.id });
    await tx.insert(characterClasses).values({ characterId: c.id, class: cls, xp });
    if (items.length) await tx.insert(inventory).values(items.map((it) => ({ characterId: c.id, ...it })));
    await tx.update(sheetUploads).set({ characterId: c.id }).where(eq(sheetUploads.id, uploadId));
    return { id: c.id, flagCount: flags.length };
  });

  await writeAudit(viewer, {
    action: "character.imported",
    characterId: done.id,
    after: { name, source: "sheet-import", uploadId, flags: done.flagCount },
  });
  refresh(done.id);
  redirect(`/characters/${done.id}`);
}

export async function uploadSheet(formData: FormData) {
  return guard(formData, uploadSheetImpl, "/characters/import");
}

export async function sendImport(formData: FormData) {
  const back = `/characters/import/${encodeURIComponent(str(formData, "uploadId"))}`;
  return guard(formData, sendImportImpl, back);
}

/* ---------- Jay (GM) and admin ---------- */

export async function approveCharacter(formData: FormData) {
  const viewer = await requireStaff();
  const id = str(formData, "id");
  const [c] = await db.select({ status: characters.status }).from(characters).where(eq(characters.id, id));
  if (!c || c.status !== "submitted") throw new Error("Only submitted characters can be approved.");
  await db.update(characters).set({ status: "approved", updatedAt: new Date() }).where(eq(characters.id, id));
  await writeAudit(viewer, { action: "character.approved", characterId: id, before: { status: c.status }, after: { status: "approved" } });
  refresh(id);
}

export async function returnToPlayer(formData: FormData) {
  const viewer = await requireStaff();
  const id = str(formData, "id");
  const note = str(formData, "note").slice(0, 300) || null;
  const [c] = await db.select({ status: characters.status }).from(characters).where(eq(characters.id, id));
  if (!c || (c.status !== "submitted" && c.status !== "approved")) throw new Error("Nothing to return.");
  await db.update(characters).set({ status: "draft", updatedAt: new Date() }).where(eq(characters.id, id));
  await writeAudit(viewer, { action: "character.returned", characterId: id, before: { status: c.status }, after: { status: "draft", note } });
  refresh(id);
}

export async function grantReroll(formData: FormData) {
  const viewer = await requireStaff();
  const id = str(formData, "id");
  const purpose = str(formData, "purpose") as "abilities" | "hp" | "gold";
  const reason = str(formData, "reason").slice(0, 200) || null;
  if (!["abilities", "hp", "gold"].includes(purpose)) throw new Error("Unknown roll");
  const [c] = await db.select({ id: characters.id }).from(characters).where(and(eq(characters.id, id), isNull(characters.deletedAt)));
  if (!c) throw new Error("Unknown character");
  await db.insert(rollGrants).values({ characterId: id, purpose, grantedBy: viewer.userId, reason });
  await writeAudit(viewer, { action: "roll.regrant", characterId: id, after: { purpose, reason } });
  refresh(id);
}
