import { randomInt } from "node:crypto";
import type { CharacterClass } from "@/db/schema";

/**
 * Dice for character creation. The server rolls; nobody can pick a result.
 * `d6` is injectable so tests can feed known faces.
 */
export type D6 = () => number;
export const cryptoD6: D6 = () => randomInt(1, 7);

export type Roll = { formula: string; dice: number[][]; totals: number[] };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Woundwort's Warren p. 5: roll 3d6 six times and arrange the scores as desired. */
export function rollAbilitySets(d6: D6 = cryptoD6): Roll {
  const dice = Array.from({ length: 6 }, () => [d6(), d6(), d6()]);
  return { formula: "3d6 × 6", dice, totals: dice.map(sum) };
}

/** Woundwort's Warren p. 6, Hit Dice by Class. */
export const HIT_DIE_ADJUST: Record<CharacterClass, number> = {
  "fighting-man": 1,
  cleric: 0,
  "magic-user": -1,
  thief: -1,
};

/** WW p. 6: player characters begin at 1st level with at least 3 hit points. */
export const FIRST_LEVEL_MINIMUM_HP = 3;

/**
 * First-level hit points: 1d6, adjusted by class (WW p. 6) and by the
 * Constitution modifier, which applies "whenever hit points are rolled" (WW p. 5);
 * never below 3 at 1st level (WW p. 6).
 */
export function rollFirstLevelHp(cls: CharacterClass, conModifier: number, d6: D6 = cryptoD6): Roll & { hp: number } {
  const face = d6();
  const adj = HIT_DIE_ADJUST[cls] + conModifier;
  const hp = Math.max(FIRST_LEVEL_MINIMUM_HP, face + adj);
  const sign = (n: number) => (n === 0 ? "" : n > 0 ? ` + ${n}` : ` − ${Math.abs(n)}`);
  return {
    formula: `1d6${sign(HIT_DIE_ADJUST[cls])}${conModifier ? `${sign(conModifier)} Con` : ""}, minimum 3`,
    dice: [[face]],
    totals: [hp],
    hp,
  };
}

/** Jay's ruling "hit-die-floor" (17 Nov 2026): every hit die after 1st level adds at least 1 hit point. */
export const LEVEL_HIT_DIE_MINIMUM = 1;

/** What one hit die adds: the 1st-level die at least 3 (WW p. 6), later dice at least 1 (hit-die-floor). */
export function hitDieGain(level: number, total: number): number {
  return Math.max(level === 1 ? FIRST_LEVEL_MINIMUM_HP : LEVEL_HIT_DIE_MINIMUM, total);
}

/**
 * Hit points for a new level after the first: 1d6 adjusted by class (WW p. 6)
 * and by the Constitution modifier (WW p. 5, "whenever hit points are rolled").
 * The 3 hp minimum is for 1st level only (WW p. 6); later dice add at least 1
 * (Jay's ruling hit-die-floor). `total` is the die as rolled and adjusted.
 */
export function rollLevelHp(
  cls: CharacterClass,
  conModifier: number,
  level: number,
  d6: D6 = cryptoD6,
): Roll & { total: number; gain: number } {
  const face = d6();
  const total = face + HIT_DIE_ADJUST[cls] + conModifier;
  const sign = (n: number) => (n === 0 ? "" : n > 0 ? ` + ${n}` : ` − ${Math.abs(n)}`);
  return {
    formula: `1d6${sign(HIT_DIE_ADJUST[cls])}${conModifier ? `${sign(conModifier)} Con` : ""}, level ${level}, minimum 1`,
    dice: [[face]],
    totals: [total],
    total,
    gain: hitDieGain(level, total),
  };
}

/** Men & Magic p. 10: 3d6 × 10 gold pieces (campaign ruling: what remains after gear). */
export function rollStartingGold(d6: D6 = cryptoD6): Roll & { gold: number } {
  const faces = [d6(), d6(), d6()];
  const gold = sum(faces) * 10;
  return { formula: "3d6 × 10 gp", dice: [faces], totals: [gold], gold };
}

/**
 * Sight in the dark for a player dwarf: WW p. 10 gives a 2 in 6 chance of the
 * latent ability to see up to 30' in darkness underground. Jay's ruling
 * "dwarf-darkvision" (17 Nov 2026): the player rolls it once at creation; a 1
 * or 2 means the dwarf can see in the dark.
 */
export const DARK_SIGHT_SOURCE = "Woundwort's Warren p. 10; Jay's ruling";

export function rollDarkSight(d6: D6 = cryptoD6): Roll & { sees: boolean } {
  const face = d6();
  return { formula: "1d6, sees in the dark on 1-2", dice: [[face]], totals: [face], sees: face <= 2 };
}
