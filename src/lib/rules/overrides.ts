import type { Alignment, CharacterClass, CharacterStatus } from "@/db/schema";
import { ABILITIES, ABILITY_NAMES, type Ability } from "./abilities";
import { CLASS_NAMES, levelFor } from "./advancement";
import { alignmentsFor, ALIGNMENTS } from "./creation";

/**
 * Editing stats by hand on the character sheet.
 *
 * Tier 1, play state: current hit points and coins. The player tracks them
 * once Jay approves the character; Jay and admins can change them on any
 * submitted or approved character. No dice are involved.
 *
 * Tier 2, overrides: Jay and admins set abilities, maximum hit points, XP,
 * name, alignment and patron directly, with a reason. The rolls behind the
 * old values stay in the roll log; the sheet marks the hand-set values.
 *
 * Drafts are left to the build wizard so creation rolls keep their meaning.
 */

/** 3d6 gives 3 to 18 (WW p. 5). Scores outside it wait on the "ability-range" ruling. */
export const ABILITY_MIN = 3;
export const ABILITY_MAX = 18;
/** Input limits, not game rules. The low end matches the sheet import form. */
export const HP_MIN = -99;
export const HP_LIMIT = 999;
export const GP_MIN = -1_000_000;
export const COIN_MAX = 10_000_000;
export const XP_LIMIT = 10_000_000;
export const NAME_MAX = 60;
export const DEITY_MAX = 60;
export const REASON_MAX = 200;

/** Fields the sheet marks as set by hand rather than rolled. */
export type ManualField = Ability | "hpMax";
export const MANUAL_FIELDS: readonly ManualField[] = [...ABILITIES, "hpMax"];

const PLAY_STATUSES: CharacterStatus[] = ["submitted", "approved"];

/** Players track play state on approved characters; staff on submitted ones too. */
export function playStateOpen(status: CharacterStatus, staff: boolean): boolean {
  return staff ? PLAY_STATUSES.includes(status) : status === "approved";
}

export function overrideOpen(status: CharacterStatus): boolean {
  return PLAY_STATUSES.includes(status);
}

const isWhole = (n: number) => Number.isInteger(n);

/* ---------- Tier 1: hit points and coins ---------- */

export type HpChange = { mode: "damage" | "heal" | "set"; amount: number };

/**
 * Works out new current hit points. Healing stops at the maximum. Only Jay
 * and admins may set current hit points above the maximum. Nothing happens
 * automatically at 0 or below ("hp-below-zero" is pending).
 */
export function applyHpChange(
  hp: { current: number; max: number },
  change: HpChange,
  staff: boolean,
): number | string {
  const { mode, amount } = change;
  if (!isWhole(amount)) return "Enter a whole number of hit points.";
  if (mode === "damage" || mode === "heal") {
    if (amount < 1) return "Enter how many hit points, 1 or more.";
    if (amount > HP_LIMIT) return `Enter ${HP_LIMIT} or less.`;
  }
  let next: number;
  if (mode === "damage") next = hp.current - amount;
  else if (mode === "heal") next = Math.max(hp.current, Math.min(hp.max, hp.current + amount));
  else if (mode === "set") next = amount;
  else return "Choose damage, heal or set.";
  if (next < HP_MIN) return `Current hit points can't go below ${HP_MIN}.`;
  if (next > HP_LIMIT) return `Current hit points can't go above ${HP_LIMIT}.`;
  if (!staff && next > hp.max && next > hp.current) return `Current hit points can't go above the maximum of ${hp.max}.`;
  return next;
}

export type Coins = { gp: number; sp: number; cp: number };

/** Gold may be negative (a debt, as on Liz's sheet); silver and copper may not. */
export function checkCoins(c: Coins): Coins | string {
  if (![c.gp, c.sp, c.cp].every(isWhole)) return "Enter whole numbers of coins.";
  if (c.gp < GP_MIN || c.gp > COIN_MAX) return `Gold must be between ${GP_MIN.toLocaleString("en-US")} and ${COIN_MAX.toLocaleString("en-US")}.`;
  if (c.sp < 0 || c.sp > COIN_MAX) return `Silver must be between 0 and ${COIN_MAX.toLocaleString("en-US")}.`;
  if (c.cp < 0 || c.cp > COIN_MAX) return `Copper must be between 0 and ${COIN_MAX.toLocaleString("en-US")}.`;
  return c;
}

/* ---------- Tier 2: overrides by Jay and admins ---------- */

export type OverrideClass = { id: string; class: CharacterClass; xp: number; highestHitDie: number };

export type OverrideCurrent = Record<Ability, number | null> & {
  name: string;
  alignment: Alignment | null;
  deity: string | null;
  hpMax: number | null;
  classes: OverrideClass[];
};

export type OverrideInput = Record<Ability, number> & {
  name: string;
  alignment: string;
  deity: string;
  hpMax: number;
  /** Keyed by character_classes.id. */
  xp: Record<string, number>;
};

export type FieldChange = { field: string; label: string; from: unknown; to: unknown };

export type OverridePlan = {
  changes: FieldChange[];
  /** Column values for `characters` that change. */
  set: Partial<Record<Ability | "hpMax", number> & { name: string; alignment: Alignment; deity: string | null }>;
  /** New XP per character_classes.id. */
  xp: Record<string, number>;
  /** Ability and hit point fields that become hand-set. */
  manual: ManualField[];
};

/**
 * Checks an override against the current character and lists what changes.
 * The active class decides which alignments are allowed (WW p. 9).
 */
export function planOverride(cur: OverrideCurrent, input: OverrideInput, activeClass: CharacterClass | null): OverridePlan | string {
  const changes: FieldChange[] = [];
  const set: OverridePlan["set"] = {};
  const manual: ManualField[] = [];

  const name = input.name.trim();
  if (!name) return "Give the character a name.";
  if (name.length > NAME_MAX) return `Keep the name to ${NAME_MAX} characters.`;
  if (name !== cur.name) {
    changes.push({ field: "name", label: "Name", from: cur.name, to: name });
    set.name = name;
  }

  const alignment = input.alignment as Alignment;
  if (!ALIGNMENTS.includes(alignment)) return "Choose lawful, neutral or chaotic.";
  if (activeClass && !alignmentsFor(activeClass).includes(alignment)) return "Thieves may be neutral or chaotic (WW p. 9).";
  if (alignment !== cur.alignment) {
    changes.push({ field: "alignment", label: "Alignment", from: cur.alignment, to: alignment });
    set.alignment = alignment;
  }

  const deityText = input.deity.trim();
  if (deityText.length > DEITY_MAX) return `Keep the patron to ${DEITY_MAX} characters.`;
  const deity = deityText || null;
  if (deity !== cur.deity) {
    changes.push({ field: "deity", label: "Patron", from: cur.deity, to: deity });
    set.deity = deity;
  }

  for (const a of ABILITIES) {
    const v = input[a];
    if (!isWhole(v) || v < ABILITY_MIN || v > ABILITY_MAX) {
      return `${ABILITY_NAMES[a]} must be a whole number from ${ABILITY_MIN} to ${ABILITY_MAX} (3d6, WW p. 5).`;
    }
    if (v !== cur[a]) {
      changes.push({ field: a, label: ABILITY_NAMES[a], from: cur[a], to: v });
      set[a] = v;
      manual.push(a);
    }
  }

  if (!isWhole(input.hpMax) || input.hpMax < 1 || input.hpMax > HP_LIMIT) {
    return `Maximum hit points must be a whole number from 1 to ${HP_LIMIT}.`;
  }
  if (input.hpMax !== cur.hpMax) {
    changes.push({ field: "hpMax", label: "Maximum hit points", from: cur.hpMax, to: input.hpMax });
    set.hpMax = input.hpMax;
    manual.push("hpMax");
  }

  const xp: Record<string, number> = {};
  for (const k of cur.classes) {
    const v = input.xp[k.id];
    if (v === undefined) return `Enter XP for ${CLASS_NAMES[k.class]}.`;
    if (!isWhole(v) || v < 0 || v > XP_LIMIT) return `XP for ${CLASS_NAMES[k.class]} must be a whole number from 0 to ${XP_LIMIT.toLocaleString("en-US")}.`;
    // Hit dice already rolled for higher levels would be left hanging (WW p. 6).
    const level = levelFor(k.class, v).level;
    if (level < k.highestHitDie) {
      return `${CLASS_NAMES[k.class]} has hit points rolled for level ${k.highestHitDie}, so its XP can't go below that level.`;
    }
    if (v !== k.xp) {
      changes.push({ field: `xp:${k.class}`, label: `XP (${CLASS_NAMES[k.class]})`, from: k.xp, to: v });
      xp[k.id] = v;
    }
  }
  for (const key of Object.keys(input.xp)) {
    if (!cur.classes.some((k) => k.id === key)) return "Unknown class";
  }

  if (changes.length === 0) return "Nothing changed.";
  return { changes, set, xp, manual };
}

/** Adds newly hand-set fields to the ones already marked, keeping the order of MANUAL_FIELDS. */
export function mergeManual(existing: readonly string[], added: readonly ManualField[]): ManualField[] {
  const all = new Set<string>([...existing, ...added]);
  return MANUAL_FIELDS.filter((f) => all.has(f));
}
