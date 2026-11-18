import type { CharacterClass, Race } from "@/db/schema";
import { CLASS_NAMES } from "./advancement";

/**
 * Saving throw bonuses, Woundwort's Warren p. 21 (Saving Throw Bonuses). Each
 * character has one base saving throw number (the advancement tables); these
 * bonuses adjust the die for certain attack forms.
 *
 * Jay's ruling "save-bonus-stacking" (17 Nov 2026): class and race bonuses
 * against the same attack add together.
 *
 * Jay's ruling "wis-vs-mind" (17 Nov 2026): Wisdom doesn't change saves
 * against charms and illusions (the referee's option on WW p. 5 is not used).
 *
 * Elves keep a separate saving throw for each class (WW p. 21 note), so the
 * class bonus belongs to the class block and the race bonus applies to both.
 */
export const SAVE_BONUS_SOURCE = "Woundwort's Warren p. 21";

export type SaveForm = "death" | "poison" | "paralysis" | "magic";
const FORM_ORDER: SaveForm[] = ["death", "poison", "paralysis", "magic"];

export type SaveBonus = {
  from: "class" | "race";
  /** "Thief", "Halfling". */
  who: string;
  bonus: number;
  against: SaveForm[];
};

const cls = (k: CharacterClass, bonus: number, against: SaveForm[]): SaveBonus => ({ from: "class", who: CLASS_NAMES[k], bonus, against });
const race = (who: string, bonus: number, against: SaveForm[]): SaveBonus => ({ from: "race", who, bonus, against });

/** WW p. 21, class rows. */
export const CLASS_SAVE_BONUSES: Record<CharacterClass, SaveBonus[]> = {
  "fighting-man": [cls("fighting-man", 1, ["death", "poison"])],
  cleric: [cls("cleric", 2, ["poison", "paralysis"])],
  "magic-user": [cls("magic-user", 2, ["magic"])],
  thief: [cls("thief", 2, ["death", "poison"])],
};

/** WW p. 21, race rows. Humans have none. */
export const RACE_SAVE_BONUSES: Record<Race, SaveBonus[]> = {
  human: [],
  elf: [race("Elf", 2, ["magic"])],
  dwarf: [race("Dwarf", 4, ["magic"]), race("Dwarf", 1, ["death", "poison"])],
  halfling: [race("Halfling", 4, ["magic"]), race("Halfling", 1, ["death", "poison"])],
};

/** "death and poison", "magic". */
export function againstText(forms: SaveForm[]): string {
  const sorted = [...forms].sort((a, b) => FORM_ORDER.indexOf(a) - FORM_ORDER.indexOf(b));
  return sorted.length <= 1 ? (sorted[0] ?? "") : `${sorted.slice(0, -1).join(", ")} and ${sorted.at(-1)}`;
}

/** "+2 vs death and poison". */
export function bonusText(b: Pick<SaveBonus, "bonus" | "against">): string {
  return `${b.bonus >= 0 ? "+" : ""}${b.bonus} vs ${againstText(b.against)}`;
}

/** The class bonus for one class, then the race bonuses. */
export function saveBonusesFor(k: CharacterClass, r: Race | null): SaveBonus[] {
  return [...CLASS_SAVE_BONUSES[k], ...(r ? RACE_SAVE_BONUSES[r] : [])];
}

/** Attack forms where both a class and a race bonus apply, so the sheet shows them added. */
export function overlappingForms(bonuses: SaveBonus[]): SaveForm[] {
  const byClass = new Set(bonuses.filter((b) => b.from === "class").flatMap((b) => b.against));
  const byRace = new Set(bonuses.filter((b) => b.from === "race").flatMap((b) => b.against));
  return FORM_ORDER.filter((f) => byClass.has(f) && byRace.has(f));
}

/** The whole bonus against one attack form: every class and race bonus added (save-bonus-stacking). 0 when none. */
export function totalAgainst(bonuses: SaveBonus[], form: SaveForm): number {
  return bonuses.filter((b) => b.against.includes(form)).reduce((n, b) => n + b.bonus, 0);
}

/** totalAgainst for one class and race. */
export function saveTotal(k: CharacterClass, r: Race | null, form: SaveForm): number {
  return totalAgainst(saveBonusesFor(k, r), form);
}

/**
 * Reads "death & poison", "vs. Magic", "poison/paralysis" from a sheet. Only
 * the words WW p. 21 uses count; null when none is named, so the importer can
 * say it couldn't read the box instead of guessing what "wands" means.
 */
export function parseAgainst(text: string): SaveForm[] | null {
  const t = text.toLowerCase();
  const forms = FORM_ORDER.filter((f) => (f === "paralysis" ? /paraly/.test(t) : t.includes(f)));
  return forms.length ? forms : null;
}

export { FORM_ORDER as SAVE_FORMS };
