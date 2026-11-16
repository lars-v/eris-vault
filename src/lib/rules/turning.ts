import type { Alignment } from "@/db/schema";

/**
 * Cleric Affecting Undead Table, Woundwort's Warren p. 8, read from the page
 * image. "Roll needed on 2d6 by level of Cleric"; T = turn, D = dispel, a dash
 * = no effect.
 *
 * WW p. 8 also says:
 * - Neutral (unaligned) clerics can't affect undead or demon-types at all.
 *   A neutral cleric who declares for Law or Chaos gains the power at once.
 * - Chaotic priests neutralize or command undead rather than turn or dispel.
 * - Demon-types of 9 HD or less count as 3 levels higher than their undead
 *   equivalent, and only 1-3 are affected. Demons of 10 HD or more: no effect.
 */
export const TURNING_SOURCE = "Woundwort's Warren p. 8";

export type TurnResult = number | "T" | "D" | null;

/** Column headings: levels 1 to 8, then 9-13, then 14+. */
export const TURNING_COLUMNS = ["1", "2", "3", "4", "5", "6", "7", "8", "9-13", "14+"] as const;

const _ = null;
export const UNDEAD: { name: string; hd: number; row: TurnResult[] }[] = [
  { name: "Skeleton", hd: 1, row: [7, 5, 3, "T", "T", "D", "D", "D", "D", "D"] },
  { name: "Zombie", hd: 2, row: [9, 7, 5, 3, "T", "T", "D", "D", "D", "D"] },
  { name: "Ghoul", hd: 3, row: [11, 9, 7, 5, 3, "T", "T", "D", "D", "D"] },
  { name: "Ghast", hd: 4, row: [_, 11, 9, 7, 5, 3, "T", "T", "D", "D"] },
  { name: "Wight", hd: 5, row: [_, _, 11, 9, 7, 5, 3, "T", "T", "D"] },
  { name: "Wraith", hd: 6, row: [_, _, _, 11, 9, 7, 5, 3, "T", "T"] },
  { name: "Mummy", hd: 7, row: [_, _, _, _, 11, 9, 7, 5, 3, "T"] },
  { name: "Spectre", hd: 8, row: [_, _, _, _, _, 11, 9, 7, 5, 3] },
  { name: "Vampire", hd: 9, row: [_, _, _, _, _, _, 11, 9, 7, 5] },
  { name: "Ghost", hd: 10, row: [_, _, _, _, _, _, _, 11, 9, 7] },
  { name: "Lich", hd: 11, row: [_, _, _, _, _, _, _, _, 11, 9] },
];

/** Index into TURNING_COLUMNS for a cleric of this level. */
export function turningColumn(level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new RangeError(`No turning column for level ${level}`);
  if (level <= 8) return level - 1;
  return level <= 13 ? 8 : 9;
}

/** What a cleric of this level needs against each undead type. */
export function turningRow(level: number): { name: string; hd: number; result: TurnResult }[] {
  const col = turningColumn(level);
  return UNDEAD.map((u) => ({ name: u.name, hd: u.hd, result: u.row[col] }));
}

/**
 * The same row sorted by result, for display: undead the cleric dispels (D),
 * turns (T), needs a 2d6 roll against, or can't affect (a dash). Each group
 * keeps the table's order, weakest first.
 */
export function turningGroups(level: number): {
  dispel: { name: string; hd: number }[];
  turn: { name: string; hd: number }[];
  roll: { name: string; hd: number; needed: number }[];
  none: { name: string; hd: number }[];
} {
  const groups: ReturnType<typeof turningGroups> = { dispel: [], turn: [], roll: [], none: [] };
  for (const { name, hd, result } of turningRow(level)) {
    if (result === "D") groups.dispel.push({ name, hd });
    else if (result === "T") groups.turn.push({ name, hd });
    else if (result === null) groups.none.push({ name, hd });
    else groups.roll.push({ name, hd, needed: result });
  }
  return groups;
}

/** WW p. 8: neutral clerics can't affect undead. Unknown alignment says nothing either way. */
export function canAffectUndead(alignment: Alignment | null): boolean | null {
  if (alignment === null) return null;
  return alignment !== "neutral";
}

export function formatTurn(r: TurnResult): string {
  return r === null ? "-" : String(r);
}
