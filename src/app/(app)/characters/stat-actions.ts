"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { and, eq, isNull, max } from "drizzle-orm";
import { db } from "@/db";
import { characterClasses, characters, hitDice, rolls } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { can } from "@/lib/roles";
import { ABILITIES } from "@/lib/rules/abilities";
import { CLASS_NAMES, levelRow, xpBelowRolledLevel } from "@/lib/rules/advancement";
import { awardTooBig } from "@/lib/rules/levelup";
import {
  applyHpChange,
  checkCoins,
  mergeManual,
  overrideOpen,
  planOverride,
  playStateOpen,
  REASON_MAX,
  XP_LIMIT,
  type HpChange,
  type HpDieRecord,
  type OverrideInput,
} from "@/lib/rules/overrides";
import { requireUser, type CurrentUser } from "@/lib/session";

/**
 * Editing stats by hand on the character sheet (see src/lib/rules/overrides.ts).
 * Hit points and coins: the player on an approved character, Jay and admins on
 * submitted ones too. Overrides: Jay and admins only, with a reason, audited.
 */

export type StatResult = { error: string | null; at: number };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => {
  const raw = str(fd, k);
  return raw === "" ? NaN : Number(raw);
};
const UUID = /^[0-9a-f-]{36}$/i;

async function guard(formData: FormData, impl: (fd: FormData) => Promise<void>): Promise<StatResult> {
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
  revalidatePath("/gm");
}

async function lockCharacter(tx: Tx, id: string) {
  if (!UUID.test(id)) throw new Error("Unknown character");
  const [c] = await tx
    .select()
    .from(characters)
    .where(and(eq(characters.id, id), isNull(characters.deletedAt)))
    .for("update");
  if (!c) throw new Error("Unknown character");
  return c;
}

/** Checks the viewer may change hit points and coins on this character now. */
function checkPlayState(viewer: CurrentUser, c: typeof characters.$inferSelect) {
  if (!can.editPlayState(viewer, c)) throw new Error("Only the player or Jay can change this character's hit points and coins.");
  const staff = can.approve(viewer);
  if (!playStateOpen(c.status, staff)) {
    throw new Error(
      staff
        ? "Hit points and coins change here once the character is submitted. Drafts use the build steps."
        : "You can track hit points and coins once Jay approves the character.",
    );
  }
  return staff;
}

/** Every GM and admin action is audited; a player's changes to their own character are not. */
async function audit(viewer: CurrentUser, action: string, characterId: string, before: unknown, after: unknown) {
  if (viewer.role === "player") return;
  await writeAudit(viewer, { action, characterId, before, after });
}

/* ---------- Tier 1: hit points and coins ---------- */

async function changeHitPointsImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  const change: HpChange = { mode: str(formData, "mode") as HpChange["mode"], amount: num(formData, "amount") };
  const result = await db.transaction(async (tx) => {
    const c = await lockCharacter(tx, id);
    const staff = checkPlayState(viewer, c);
    if (c.hpMax === null || c.hpCurrent === null) throw new Error("This character has no hit points yet.");
    const next = applyHpChange({ current: c.hpCurrent, max: c.hpMax }, change, staff);
    if (typeof next === "string") throw new Error(next);
    if (next === c.hpCurrent) return null;
    await tx.update(characters).set({ hpCurrent: next, updatedAt: new Date() }).where(eq(characters.id, id));
    return { from: c.hpCurrent, to: next };
  });
  if (result) {
    await audit(viewer, "character.hp_changed", id, { hpCurrent: result.from }, { hpCurrent: result.to, ...change });
  }
  refresh(id);
}

async function setCoinsImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  const coins = checkCoins({ gp: num(formData, "gp"), sp: num(formData, "sp"), cp: num(formData, "cp") });
  if (typeof coins === "string") throw new Error(coins);
  const result = await db.transaction(async (tx) => {
    const c = await lockCharacter(tx, id);
    checkPlayState(viewer, c);
    const before = { gp: c.coinsGp, sp: c.coinsSp, cp: c.coinsCp };
    if (before.gp === coins.gp && before.sp === coins.sp && before.cp === coins.cp) return null;
    await tx
      .update(characters)
      .set({ coinsGp: coins.gp, coinsSp: coins.sp, coinsCp: coins.cp, updatedAt: new Date() })
      .where(eq(characters.id, id));
    return before;
  });
  if (result) await audit(viewer, "character.coins_changed", id, result, coins);
  refresh(id);
}

/* ---------- Tier 2: overrides by Jay and admins ---------- */

/**
 * Every die behind maximum hit points, for a Constitution recount (Jay's
 * ruling con-change-hp). Null when they can't all be read from the rolls:
 * a character from a sheet, levels the sheet brought in, a hand-set maximum,
 * or a total that doesn't match the dice.
 */
async function hpDiceFor(
  tx: Tx,
  c: typeof characters.$inferSelect,
  classRows: (typeof characterClasses.$inferSelect)[],
  firstClass: (typeof characterClasses.$inferSelect)["class"] | null,
): Promise<HpDieRecord[] | null> {
  if (c.source !== "app" || !c.hpRollId || !firstClass || c.hpMax === null || c.manualFields.includes("hpMax")) return null;
  if (classRows.some((k) => k.baseHpLevel !== 1)) return null;
  const [first] = await tx.select({ dice: rolls.dice, totals: rolls.totals }).from(rolls).where(eq(rolls.id, c.hpRollId));
  const later = await tx
    .select({ id: hitDice.id, cls: hitDice.class, level: hitDice.level, gain: hitDice.gain, dice: rolls.dice })
    .from(hitDice)
    .leftJoin(rolls, eq(rolls.id, hitDice.rollId))
    .where(and(eq(hitDice.characterId, c.id), isNull(hitDice.lostAt)));
  const face = first?.dice[0]?.[0];
  if (face === undefined) return null;
  const dice: HpDieRecord[] = [
    { id: null, cls: firstClass, level: 1, face, gain: first.totals[0] },
    ...later.map((d) => ({ id: d.id, cls: d.cls, level: d.level, face: d.dice?.[0]?.[0] ?? null, gain: d.gain ?? 0 })),
  ];
  if (dice.reduce((n, d) => n + d.gain, 0) !== c.hpMax) return null;
  return dice;
}

async function overrideStatsImpl(formData: FormData) {
  const viewer = await requireUser();
  if (!can.overrideStats(viewer)) throw new Error("Only Jay or an admin can set stats by hand.");
  const id = str(formData, "id");
  const reason = str(formData, "reason");
  if (!reason) throw new Error("Give a reason. It goes in the audit log and on the sheet.");
  if (reason.length > REASON_MAX) throw new Error(`Keep the reason to ${REASON_MAX} characters.`);

  const result = await db.transaction(async (tx) => {
    const c = await lockCharacter(tx, id);
    if (!overrideOpen(c.status)) throw new Error("Stats are set by hand on submitted or approved characters. Drafts use the build steps.");
    const classRows = await tx.select().from(characterClasses).where(eq(characterClasses.characterId, id));
    const rolled = await tx
      .select({ class: hitDice.class, top: max(hitDice.level) })
      .from(hitDice)
      .where(and(eq(hitDice.characterId, id), isNull(hitDice.lostAt)))
      .groupBy(hitDice.class);
    const xpInput: Record<string, number> = {};
    for (const k of classRows) xpInput[k.id] = num(formData, `xp-${k.id}`);
    const input = {
      ...Object.fromEntries(ABILITIES.map((a) => [a, num(formData, a)])),
      name: str(formData, "name"),
      alignment: str(formData, "alignment"),
      deity: str(formData, "deity"),
      hpMax: num(formData, "hpMax"),
      xp: xpInput,
      hpRecounted: formData.get("hpRecounted") === "on",
    } as OverrideInput;
    const active = classRows.find((k) => k.active) ?? classRows[0];
    const hpDice = await hpDiceFor(tx, c, classRows, active?.class ?? null);
    const plan = planOverride(
      {
        ...Object.fromEntries(ABILITIES.map((a) => [a, c[a]])),
        name: c.name,
        alignment: c.alignment,
        deity: c.deity,
        hpMax: c.hpMax,
        classes: classRows.map((k) => ({
          id: k.id,
          class: k.class,
          xp: k.xp,
          highestHitDie: rolled.find((r) => r.class === k.class)?.top ?? 0,
        })),
        hpDice,
      } as Parameters<typeof planOverride>[0],
      input,
      active?.class ?? null,
    );
    if (typeof plan === "string") throw new Error(plan);
    await tx
      .update(characters)
      .set({ ...plan.set, manualFields: mergeManual(c.manualFields, plan.manual), updatedAt: new Date() })
      .where(eq(characters.id, id));
    for (const [classId, xp] of Object.entries(plan.xp)) {
      await tx.update(characterClasses).set({ xp }).where(and(eq(characterClasses.id, classId), eq(characterClasses.characterId, id)));
    }
    // Constitution recount (Jay's ruling con-change-hp): each hit die keeps its roll and records its new gain.
    for (const d of plan.dieGains) {
      await tx.update(hitDice).set({ gain: d.gain }).where(and(eq(hitDice.id, d.id), eq(hitDice.characterId, id)));
    }
    return plan.changes;
  });

  await writeAudit(viewer, {
    action: "character.override",
    characterId: id,
    before: Object.fromEntries(result.map((ch) => [ch.field, ch.from])),
    after: { ...Object.fromEntries(result.map((ch) => [ch.field, ch.to])), reason },
  });
  refresh(id);
  revalidatePath(`/characters/${id}/build`);
}

/* ---------- XP ---------- */

/**
 * Sets one class's XP to a new total, typed straight into the sheet. The
 * player on an approved character, Jay and admins on submitted ones too
 * (can.editXp). Every change is audited, the player's too, so Jay sees it.
 * WW p. 11: no bonus or penalty to earned XP for high or low scores.
 */
async function setXpImpl(formData: FormData) {
  const viewer = await requireUser();
  const id = str(formData, "id");
  const classId = str(formData, "classId");
  const xp = num(formData, "xp");
  if (!UUID.test(classId)) throw new Error("Unknown class");
  if (!Number.isInteger(xp) || xp < 0 || xp > XP_LIMIT) throw new Error(`XP must be a whole number from 0 to ${XP_LIMIT.toLocaleString("en-US")}.`);
  const change = await db.transaction(async (tx) => {
    const c = await lockCharacter(tx, id);
    if (!can.editXp(viewer, c)) {
      throw new Error(c.ownerId === viewer.userId ? "You can change XP once Jay approves the character." : "Only the player or Jay can change this character's XP.");
    }
    if (c.status !== "submitted" && c.status !== "approved") throw new Error("XP changes here once the character is submitted.");
    const [k] = await tx
      .select()
      .from(characterClasses)
      .where(and(eq(characterClasses.id, classId), eq(characterClasses.characterId, id)));
    if (!k) throw new Error("Unknown class");
    if (xp === k.xp) return null;
    // No single award gains more than one level (Jay's ruling one-level-per-adventure).
    // Jay fixes a mistake with Set stats by hand, which needs a reason.
    const tooBig = awardTooBig(c.race, k.class, k.xp, xp);
    if (tooBig) throw new Error(tooBig);
    if (xp < k.xp) {
      const [row] = await tx
        .select({ level: max(hitDice.level) })
        .from(hitDice)
        .where(and(eq(hitDice.characterId, id), eq(hitDice.class, k.class), isNull(hitDice.lostAt)));
      const top = row?.level ?? 0;
      const below = xpBelowRolledLevel(k.class, xp, top);
      if (below) {
        const floor = levelRow(k.class, top).xp.toLocaleString("en-US");
        throw new Error(
          can.approve(viewer)
            ? below
            : `${CLASS_NAMES[k.class]} has hit points rolled for level ${top}, so XP can't go below ${floor}. Ask Jay if you lost a level.`,
        );
      }
    }
    await tx.update(characterClasses).set({ xp }).where(eq(characterClasses.id, k.id));
    await tx.update(characters).set({ updatedAt: new Date() }).where(eq(characters.id, id));
    await writeAudit(
      viewer,
      { action: "character.xp_set", characterId: id, before: { class: k.class, xp: k.xp }, after: { class: k.class, xp } },
      tx,
    );
    return true;
  });
  if (change) refresh(id);
}

export async function setXp(_prev: StatResult, formData: FormData): Promise<StatResult> {
  return guard(formData, setXpImpl);
}

export async function changeHitPoints(_prev: StatResult, formData: FormData): Promise<StatResult> {
  return guard(formData, changeHitPointsImpl);
}

export async function setCoins(_prev: StatResult, formData: FormData): Promise<StatResult> {
  return guard(formData, setCoinsImpl);
}

export async function overrideStats(_prev: StatResult, formData: FormData): Promise<StatResult> {
  return guard(formData, overrideStatsImpl);
}
