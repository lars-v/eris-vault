/**
 * Ability score modifiers.
 * Source: Woundwort's Warren (Planet Eris House Rules), p. 5,
 * "Ability Scores Bonuses & Penalties": 3 = -2, 4-6 = -1, 7-14 = 0, 15-17 = +1, 18 = +2.
 */
export const ABILITIES = ["str", "int", "wis", "dex", "con", "cha"] as const;
export type Ability = (typeof ABILITIES)[number];

export const ABILITY_NAMES: Record<Ability, string> = {
  str: "Strength",
  int: "Intelligence",
  wis: "Wisdom",
  dex: "Dexterity",
  con: "Constitution",
  cha: "Charisma",
};

export const ABILITY_SOURCE = "Woundwort's Warren p. 5";

export function abilityModifier(score: number): number {
  if (!Number.isInteger(score) || score < 3 || score > 18) {
    throw new RangeError(`Ability score must be an integer from 3 to 18, got ${score}`);
  }
  if (score === 3) return -2;
  if (score <= 6) return -1;
  if (score <= 14) return 0;
  if (score <= 17) return 1;
  return 2;
}

export function formatModifier(mod: number): string {
  if (mod > 0) return `+${mod}`;
  if (mod < 0) return `−${Math.abs(mod)}`;
  return "0";
}
