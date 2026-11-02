import type { ImportFlag } from "@/db/schema";

/**
 * Liz the Giz, as recorded on Lars's fillable PDF sheet
 * ("PC - Liz the giz - cleric - Lars.pdf", October 2026).
 * Encumbrance units are the ones written on that sheet; magic gear counts 0
 * by campaign ruling. Mismatches with the books are kept as flags for Jay,
 * not silently corrected.
 */
export const LIZ = {
  name: "Liz the Giz",
  race: "human" as const,
  alignment: "lawful" as const,
  cls: "cleric" as const,
  xp: 7420,
  scores: { str: 8, int: 9, wis: 16, dex: 11, con: 10, cha: 15 },
  hpCurrent: 13,
  hpMax: 18,
  coinsGp: -15,
  deity: "Ashan",
  notes: "Retainer: Randy, fighting-man, 3 HP.",
  items: [
    { name: "Plate mail +2", kind: "Armor", encUnits: 0, isMagic: true, magicBonus: 2 },
    { name: "Mace +2", kind: "Weapon", encUnits: 0, isMagic: true, magicBonus: 2 },
    { name: "Shield", kind: "Armor", encUnits: 3 },
    { name: "Holy symbol, silver", kind: "Gear", encUnits: 1 },
    { name: "Backpack", kind: "Gear", encUnits: 1 },
    { name: "Bedroll", kind: "Gear", encUnits: 2 },
    { name: "Rations, iron (7 days)", kind: "Food", encUnits: 2 },
    { name: "Waterskin", kind: "Gear", encUnits: 1 },
    { name: "Torches (6)", kind: "Light", encUnits: 1 },
    { name: "Tinderbox", kind: "Light", encUnits: 0 },
    { name: "Rope, hemp (50 ft)", kind: "Gear", encUnits: 1 },
  ],
  flags: [
    {
      title: "Level says 3; XP says 4",
      body: "7,420 XP is past the 6,000 needed for Vicar. The sheet's save of 10 and its to-hit row already match 4th level.",
      source: "WW p. 8",
    },
    {
      title: "A 3rd-level spell is prepared",
      body: "Cure Disease is prepared, but a Vicar has 2 + 1 (Wis) 1st-level slots and 1 2nd-level slot, and no 3rd.",
      source: "WW pp. 5, 8",
    },
    {
      title: "Save bonus wording",
      body: "The sheet says +2 vs poison and mind-affecting. Clerics get +2 vs poison and paralysis; Wis vs mind-affecting is optional and would be +1.",
      source: "WW pp. 5, 23",
    },
    { title: "Negative gold", body: "Coins show -15 gp.", source: "Imported sheet" },
    {
      title: "Spells not on the house list",
      body: "Snake Charm and Prayer are marked * on the sheet and aren't on the WW cleric list.",
      source: "WW p. 26",
    },
  ] satisfies ImportFlag[],
};
