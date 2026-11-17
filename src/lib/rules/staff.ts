import type { CharacterClass, Race } from "@/db/schema";
import { abilityModifier } from "./abilities";
import { spell, spellsFor, type Spell } from "./spells";

/**
 * The spell-storing staff or wand.
 *
 * - WW p. 5: an Intelligence bonus is "the number of first level spells that a
 *   magic-user may store in his personal staff or wand".
 * - WW p. 7: a magic-user with an Intelligence bonus may carry a staff for
 *   storing spells. Int 15-17 stores one 1st-level spell, Int 18 two. The staff
 *   may be a found magic staff, a specially made one, or plain hardwood. A spell
 *   is stored by casting it on the staff and may be loosed at any time; once
 *   used it must be cast on the staff again. Magic-users and elves may use a
 *   wand instead. Only one staff or wand at a time.
 * - 1st-level magic-user spells: WW p. 26 (the list in spells.ts).
 *
 * Open questions left to Jay (rulings seed in scripts/migrate.mjs):
 * - "elf-wand-int": does an elf need an Intelligence bonus too? Here the same
 *   Intelligence rule applies to elves, and the card says so.
 * - "staff-carry-over-rest": does a stored spell last through rest? Here it
 *   stays stored until released.
 * - "staff-same-spell-twice": may both slots hold the same spell? Allowed here,
 *   and shown as a warning.
 * - "staff-loss": is a stored spell lost with the staff? Nothing is cleared
 *   here; the card warns, and Jay can void the slot.
 * - "staff-int-drop": what happens to stored spells past a lowered capacity?
 *   Nothing is cleared here; the card warns.
 */
export const STAFF_SOURCE = "Woundwort's Warren pp. 5, 7";

export type StaffSlot = 1 | 2;
export const STAFF_SLOTS: readonly StaffSlot[] = [1, 2];
export const STAFF_NOTE_MAX = 300;

export type StaffAction = "load" | "release" | "void";
export const STAFF_ACTIONS: readonly StaffAction[] = ["load", "release", "void"];

/** The price-list item that is a staff (WW p. 17). */
export const STAFF_CATALOG_KEY = "staff";

/**
 * How many 1st-level spells the character's staff or wand can hold: 0, 1 or 2
 * (WW pp. 5, 7). Only a character with a magic-user class, which includes an
 * elf who has magic-user as one of its two classes (WW p. 10). The same
 * Intelligence rule applies to elves until "elf-wand-int" is decided.
 */
export function staffCapacity(classes: readonly CharacterClass[], race: Race | null, int: number | null): 0 | 1 | 2 {
  void race; // Elves use the same rule for now (pending "elf-wand-int").
  if (!classes.includes("magic-user") || int === null) return 0;
  const bonus = abilityModifier(int);
  return bonus >= 2 ? 2 : bonus === 1 ? 1 : 0;
}

/** The spells a staff can hold: every 1st-level magic-user spell (WW p. 26). */
export function staffSpells(): Spell[] {
  return spellsFor("magic-user", 1);
}

export function isStaffSpell(key: string): boolean {
  const s = spell(key);
  return s !== undefined && s.cls === "magic-user" && s.level === 1;
}

export function isStaffSlot(n: number): n is StaffSlot {
  return n === 1 || n === 2;
}

export type StaffEvent = {
  slot: number;
  spell: string | null;
  action: StaffAction;
  inventoryId: string | null;
  createdAt: Date;
};

export type SlotState = {
  slot: StaffSlot;
  /** Spell key while loaded, null when empty. */
  spell: string | null;
  /** The focus item the spell was cast into. */
  inventoryId: string | null;
  /** The latest event for this slot, or null if there has never been one. */
  last: StaffEvent | null;
};

/**
 * Each slot's current state: its latest event (a load fills it; a release or
 * a void empties it). Events may come in any order.
 */
export function slotStates(events: readonly StaffEvent[]): SlotState[] {
  return STAFF_SLOTS.map((slot) => {
    let last: StaffEvent | null = null;
    for (const e of events) {
      if (e.slot !== slot) continue;
      if (!last || e.createdAt.getTime() >= last.createdAt.getTime()) last = e;
    }
    const loaded = last?.action === "load" ? last : null;
    return { slot, spell: loaded?.spell ?? null, inventoryId: loaded?.inventoryId ?? null, last };
  });
}

const stateOf = (states: readonly SlotState[], slot: number) => states.find((s) => s.slot === slot);

/** Checks a load before it happens. Returns a problem as a message, or null. */
export function checkLoad(input: {
  states: readonly SlotState[];
  capacity: number;
  slot: number;
  spell: string;
  hasFocus: boolean;
}): string | null {
  if (input.capacity === 0) return "Only a magic-user with an Intelligence bonus (15+) can store spells in a staff (WW p. 7).";
  if (!input.hasFocus) return "Set a staff or wand as the spell focus first.";
  if (!isStaffSlot(input.slot)) return "That slot doesn't exist.";
  if (input.slot > input.capacity) {
    return `Intelligence ${input.capacity === 1 ? "15 to 17 stores one spell" : "18 stores two spells"}, so slot ${input.slot} can't be used (WW p. 7).`;
  }
  if (!isStaffSpell(input.spell)) return "A staff stores 1st-level magic-user spells only (WW pp. 7, 26).";
  const s = stateOf(input.states, input.slot);
  if (s?.spell) return `Slot ${input.slot} already holds ${spell(s.spell)?.name ?? "a spell"}. Release it first.`;
  return null;
}

/** Checks a release (or a void) before it happens. Returns a problem as a message, or null. */
export function checkRelease(states: readonly SlotState[], slot: number): string | null {
  if (!isStaffSlot(slot)) return "That slot doesn't exist.";
  if (!stateOf(states, slot)?.spell) return `Slot ${slot} is already empty.`;
  return null;
}

/** Checks Jay's void: the slot must hold a spell and the note must say why. */
export function checkVoid(states: readonly SlotState[], slot: number, note: string): string | null {
  const problem = checkRelease(states, slot);
  if (problem) return problem;
  if (!note.trim()) return "Say why the spell is voided (for example, the staff broke).";
  if (note.length > STAFF_NOTE_MAX) return `Keep the note to ${STAFF_NOTE_MAX} characters.`;
  return null;
}

export type StaffWarning = { ruling: string; text: string };

/**
 * Things the card should flag without changing anything (never automatic
 * deletion). `focusId` is the current focus item, null if none.
 */
export function staffWarnings(input: {
  states: readonly SlotState[];
  capacity: number;
  focusId: string | null;
  itemIds: ReadonlySet<string>;
}): StaffWarning[] {
  const warnings: StaffWarning[] = [];
  const loaded = input.states.filter((s) => s.spell);
  const over = loaded.filter((s) => s.slot > input.capacity);
  if (over.length > 0) {
    warnings.push({
      ruling: "staff-int-drop",
      text:
        input.capacity === 0
          ? `This character can't store spells now, but ${over.length === 1 ? "a spell is" : "spells are"} still stored.`
          : `Slot ${over.map((s) => s.slot).join(" and ")} holds a spell past what Intelligence now allows.`,
    });
  }
  const gone = loaded.filter((s) => !s.inventoryId || !input.itemIds.has(s.inventoryId));
  const moved = loaded.filter((s) => s.inventoryId && input.itemIds.has(s.inventoryId) && s.inventoryId !== input.focusId);
  if (gone.length > 0) {
    warnings.push({ ruling: "staff-loss", text: `The staff or wand holding ${names(gone)} is no longer in this character's gear.` });
  }
  if (moved.length > 0) {
    warnings.push({ ruling: "staff-loss", text: `${names(moved)} ${moved.length === 1 ? "was" : "were"} stored in an item that is no longer the spell focus.` });
  }
  const keys = loaded.map((s) => s.spell);
  if (keys.length === 2 && keys[0] === keys[1]) {
    warnings.push({ ruling: "staff-same-spell-twice", text: `Both slots hold ${names(loaded.slice(0, 1))}.` });
  }
  return warnings;
}

function names(states: readonly SlotState[]): string {
  return states.map((s) => (s.spell ? spell(s.spell)?.name ?? s.spell : "a spell")).join(" and ");
}

/**
 * The party page badge, for example "Staff: Sleep ready" or "Staff: empty".
 * Null when nothing is stored and no staff or wand is set as the focus.
 */
export function staffBadge(states: readonly SlotState[], hasFocus: boolean): string | null {
  const loaded = states.filter((s) => s.spell).map((s) => spell(s.spell!)?.name ?? s.spell!);
  if (loaded.length === 0) return hasFocus ? "Staff: empty" : null;
  return `Staff: ${loaded.join(", ")} ready`;
}
