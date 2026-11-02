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

/** Men & Magic p. 10: 3d6 × 10 gold pieces (campaign ruling: what remains after gear). */
export function rollStartingGold(d6: D6 = cryptoD6): Roll & { gold: number } {
  const faces = [d6(), d6(), d6()];
  const gold = sum(faces) * 10;
  return { formula: "3d6 × 10 gp", dice: [faces], totals: [gold], gold };
}
