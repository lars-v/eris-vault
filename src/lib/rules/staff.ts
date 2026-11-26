import type { CharacterClass } from "@/db/schema";
import { abilityModifier } from "./abilities";
import { knownSpells, spell, type Spell } from "./spells";

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
 * - 1st-level magic-user spells: WW p. 26 (the list in spells.ts). Only spells
 *   in the magic-user's spellbook can be cast on the staff (table ruling
 *   magic-user-spellbook, 25 Nov 2026). A spell already stored stays when it
 *   leaves the book.
 *
 * Jay's rulings (17 Nov 2026):
 * - "elf-wand-int": elves need an Intelligence bonus (15+) like any magic-user.
 * - "staff-carry-over-rest": a stored spell stays until it is used, through any
 *   amount of rest.
 * - "staff-same-spell-twice": both slots may hold the same spell.
 * - "staff-loss": if the staff or wand is broken, stolen or dropped, the stored
 *   spells are lost. Removing the item from the character's gear voids them
 *   (lostWithItem); Jay voids them by hand when the staff is lost in play.
 * - "staff-int-drop": a stored spell past a lowered limit stays until it is
 *   released, but no new spell can be loaded past the limit (checkLoad).
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
 * elf who has magic-user as one of its two classes (WW p. 10). Elves follow
 * the same Intelligence rule (Jay's ruling elf-wand-int).
 */
export function staffCapacity(classes: readonly CharacterClass[], int: number | null): 0 | 1 | 2 {
  if (!classes.includes("magic-user") || int === null) return 0;
  const bonus = abilityModifier(int);
  return bonus >= 2 ? 2 : bonus === 1 ? 1 : 0;
}

/** The spells that can be cast on the staff: 1st-level spells in the spellbook (WW pp. 7, 26; ruling magic-user-spellbook). */
export function staffSpells(spellbook: readonly string[]): Spell[] {
  return knownSpells("magic-user", spellbook).filter((s) => s.level === 1);
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
  /** The magic-user's spellbook (ruling magic-user-spellbook). */
  spellbook: readonly string[];
}): string | null {
  if (input.capacity === 0) return "Only a magic-user with an Intelligence bonus (15+) can store spells in a staff (WW p. 7).";
  if (!input.hasFocus) return "Set a staff or wand as the spell focus first.";
  if (!isStaffSlot(input.slot)) return "That slot doesn't exist.";
  if (input.slot > input.capacity) {
    return `Intelligence ${input.capacity === 1 ? "15 to 17 stores one spell" : "18 stores two spells"}, so slot ${input.slot} can't be used (WW p. 7).`;
  }
  if (!isStaffSpell(input.spell)) return "A staff stores 1st-level magic-user spells only (WW pp. 7, 26).";
  if (!input.spellbook.includes(input.spell)) return `${spell(input.spell)!.name} isn't in this character's spellbook. Add it there first.`;
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

export type StaffWarning = { ruling: string | null; text: string };

/**
 * Things the card should flag without changing anything. `focusId` is the
 * current focus item, null if none.
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
        (input.capacity === 0
          ? `This character can't store spells now, but ${over.length === 1 ? "a spell is" : "spells are"} still stored.`
          : `Slot ${over.map((s) => s.slot).join(" and ")} holds a spell past what Intelligence now allows.`) +
        " It stays until released, but no new spell can be loaded there.",
    });
  }
  // Spells stored in an item removed before the staff-loss ruling, which nothing voided.
  const gone = loaded.filter((s) => !s.inventoryId || !input.itemIds.has(s.inventoryId));
  const moved = loaded.filter((s) => s.inventoryId && input.itemIds.has(s.inventoryId) && s.inventoryId !== input.focusId);
  if (gone.length > 0) {
    warnings.push({
      ruling: "staff-loss",
      text: `The staff or wand holding ${names(gone)} is no longer in this character's gear, so the spell is lost. Jay voids the slot.`,
    });
  }
  if (moved.length > 0) {
    warnings.push({ ruling: null, text: `${names(moved)} ${moved.length === 1 ? "was" : "were"} stored in an item that is no longer the spell focus.` });
  }
  return warnings;
}

/** Slots whose spell is stored in this item, to void when the item leaves the character's gear (staff-loss). */
export function lostWithItem(states: readonly SlotState[], itemId: string): SlotState[] {
  return states.filter((s) => s.spell && s.inventoryId === itemId);
}

/** The note on a void written because the staff or wand left the character's gear. */
export const LOST_WITH_ITEM_NOTE = "Lost with the staff or wand when it left the character's gear (Jay's ruling staff-loss).";

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
