import type { CharacterClass } from "@/db/schema";

/**
 * "To hit" rolls for characters: the Character Combat Matrix, Woundwort's
 * Warren p. 20, read from the page image. WW p. 19: fighting-men improve every
 * level, clerics every 2 levels, magic-users every 3. Thieves use the cleric's
 * progression (WW p. 20 footnote). Dwarves fight as fighting-men (WW p. 9);
 * elves keep a separate record for each class (WW p. 10).
 *
 * The magic-user column prints row 2 as levels 4-6 and row 3 as 5-9, so 5th
 * and 6th level sit in both rows. WW p. 19 ("every 3 experience levels")
 * points to 7-9, but the choice is Jay's (pending ruling "mu-combat-rows"),
 * so combatRows returns both rows for those levels.
 */
export const COMBAT_SOURCE = "Woundwort's Warren pp. 19-20";

/** Armor classes across the top of the matrix, left to right. */
export const ARMOR_CLASSES = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5] as const;

/** d20 roll needed to hit each armor class above, by matrix row 0 to 10. */
const MATRIX: number[][] = [
  [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 20, 20, 20, 20, 20],
  [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 20, 20, 20, 20],
  [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 20, 20, 20],
  [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 20, 20],
  [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 20],
  [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
  [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
  [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
  [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  [2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
];

type Column = "fighting-man" | "cleric" | "magic-user";

/** Levels listed against matrix rows 1 to 10, as printed (index 0 = row 1). */
const COLUMNS: Record<Column, [number, number][]> = {
  "fighting-man": [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [8, 8], [9, 9], [10, 10]],
  cleric: [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18], [19, 20]],
  "magic-user": [[1, 3], [4, 6], [5, 9], [10, 12], [13, 15], [16, 18], [19, 21], [22, 24], [25, 27], [28, 30]],
};

const COLUMN_FOR: Record<CharacterClass, Column> = {
  "fighting-man": "fighting-man",
  cleric: "cleric",
  "magic-user": "magic-user",
  thief: "cleric",
};

export type CombatRow = { row: number; toHit: number[] };

/** Matrix rows that list this class and level. Two rows only where the book lists the level twice. */
export function combatRows(cls: CharacterClass, level: number): CombatRow[] {
  if (!Number.isInteger(level) || level < 1) throw new RangeError(`No combat row for level ${level}`);
  const out: CombatRow[] = [];
  COLUMNS[COLUMN_FOR[cls]].forEach(([lo, hi], i) => {
    if (level >= lo && level <= hi) out.push({ row: i + 1, toHit: MATRIX[i + 1] });
  });
  if (out.length === 0) throw new RangeError(`No combat row for level ${level}`);
  return out;
}

/** The pending ruling that applies to this class and level's row, if any. */
export function combatRuling(cls: CharacterClass, level: number): string | null {
  return combatRows(cls, level).length > 1 ? "mu-combat-rows" : null;
}

/** Roll needed to hit one armor class, one value per row combatRows returned. */
export function toHit(cls: CharacterClass, level: number, ac: (typeof ARMOR_CLASSES)[number]): number[] {
  const i = ARMOR_CLASSES.indexOf(ac);
  return combatRows(cls, level).map((r) => r.toHit[i]);
}
