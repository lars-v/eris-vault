import type { CharacterClass, Race } from "@/db/schema";
import { levelFor, maxLevel } from "./advancement";

/**
 * Taking levels away.
 *
 * Jay's rulings "drain-xp", "drain-hp-current" and "regain-drained-level"
 * (17 Nov 2026): this campaign has no level drain (Monsters & Treasure p. 9).
 * Undead drain abilities instead, temporarily (Melan's energy drain, house
 * rules p. 56; for example a Wight's hit drains Constitution equal to the
 * hit points it does, and a character with an ability at 0 dies). The vault's
 * copy of the house rules ends at p. 52, so that rule waits on the page
 * ("energy-drain" is pending).
 *
 * What is left here is Jay's tool for taking back levels given by mistake:
 * Jay sets a lower XP, each level above it loses its hit die (marked lost; the
 * roll stays in the log) and its hit points come off the maximum. Current hit
 * points are left alone. A level earned again rolls a new hit die (WW p. 6).
 */
export const DRAIN_SOURCE = "Jay's rulings, 17 Nov 2026";

export type DrainDie = { id: string; level: number; gain: number | null };

export type DrainInput = {
  race: Race | null;
  cls: CharacterClass;
  xp: number;
  /** The level the class's hit points covered when it entered the app (characterClasses.baseHpLevel). */
  baseHpLevel: number;
  /** Hit dice rolled in the app for this class and not already lost. */
  dice: DrainDie[];
  hpMax: number;
  newXp: number;
  /**
   * Hit points the lost levels gave when no die is on record for them (an
   * imported sheet's levels). Null until Jay enters it.
   */
  untrackedHpLost: number | null;
};

export type DrainPlan = {
  fromLevel: number;
  toLevel: number;
  /** Dice whose levels are lost, highest first. */
  lostDice: DrainDie[];
  /** Lost levels whose hit points came in a lump from an imported sheet. */
  untrackedLevels: number[];
  hpLost: number;
  newHpMax: number;
  newBaseHpLevel: number;
};

const XP_LIMIT = 10_000_000;
const isWhole = (n: number) => Number.isInteger(n);

/** The level shown on the sheet: XP's level, held at the race's cap (WW pp. 7-10). */
const shownLevel = (race: Race | null, cls: CharacterClass, xp: number) => Math.min(levelFor(cls, xp).level, maxLevel(race, cls));

/** Levels whose hit points need Jay's number, before any is entered. */
export function untrackedLevelsFor(input: Pick<DrainInput, "race" | "cls" | "baseHpLevel" | "newXp">): number[] {
  if (!isWhole(input.newXp) || input.newXp < 0) return [];
  const to = shownLevel(input.race, input.cls, input.newXp);
  const out: number[] = [];
  for (let l = input.baseHpLevel; l > to && l > 1; l--) out.push(l);
  return out;
}

export function planDrain(input: DrainInput): DrainPlan | string {
  const { race, cls, xp, newXp, dice, hpMax, baseHpLevel } = input;
  if (!isWhole(newXp) || newXp < 0 || newXp > XP_LIMIT) return "Enter the new XP as a whole number, 0 or more.";
  if (newXp >= xp) return `The new XP has to be lower than the ${xp.toLocaleString("en-US")} XP the character has now.`;
  const fromLevel = shownLevel(race, cls, xp);
  const toLevel = shownLevel(race, cls, newXp);

  const lostDice = dice.filter((d) => d.level > toLevel).sort((a, b) => b.level - a.level);
  const untrackedLevels = untrackedLevelsFor({ race, cls, baseHpLevel, newXp });
  let untrackedHp = 0;
  if (untrackedLevels.length > 0) {
    const n = input.untrackedHpLost;
    if (n === null || !isWhole(n) || n < 0) {
      const which = untrackedLevels.length === 1 ? `level ${untrackedLevels[0]}` : `levels ${[...untrackedLevels].reverse().join(", ")}`;
      return `No hit die is on record for ${which} (the hit points came from the uploaded sheet). Enter the hit points ${untrackedLevels.length === 1 ? "it" : "they"} gave.`;
    }
    untrackedHp = n;
  }
  const hpLost = lostDice.reduce((sum, d) => sum + (d.gain ?? 0), 0) + untrackedHp;
  const newHpMax = hpMax - hpLost;
  if (newHpMax < 1) {
    return `That takes maximum hit points to ${newHpMax}. The vault keeps them at 1 or more, so set the sheet by hand with a reason instead.`;
  }
  return { fromLevel, toLevel, lostDice, untrackedLevels, hpLost, newHpMax, newBaseHpLevel: Math.min(baseHpLevel, toLevel) };
}
