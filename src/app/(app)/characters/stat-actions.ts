"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { and, eq, isNull, max } from "drizzle-orm";
import { db } from "@/db";
import { characterClasses, characters, hitDice } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { can } from "@/lib/roles";
import { ABILITIES } from "@/lib/rules/abilities";
import {
  applyHpChange,
  checkCoins,
  mergeManual,
  overrideOpen,
  planOverride,
  playStateOpen,
  REASON_MAX,
  type HpChange,
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
      .where(eq(hitDice.characterId, id))
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
    } as OverrideInput;
    const active = classRows.find((k) => k.active) ?? classRows[0];
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

export async function changeHitPoints(_prev: StatResult, formData: FormData): Promise<StatResult> {
  return guard(formData, changeHitPointsImpl);
}

export async function setCoins(_prev: StatResult, formData: FormData): Promise<StatResult> {
  return guard(formData, setCoinsImpl);
}

export async function overrideStats(_prev: StatResult, formData: FormData): Promise<StatResult> {
  return guard(formData, overrideStatsImpl);
}
