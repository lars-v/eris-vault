import { describe, expect, it } from "vitest";
import {
  checkPrepared,
  knownSpells,
  maxSpellLevel,
  preparedOutsideBook,
  sameSpellbook,
  setSpellbookSpell,
  spell,
  SPELLS,
  spellSlots,
  spellsFor,
} from "@/lib/rules/spells";

describe("spells per day (Woundwort's Warren pp. 7-8)", () => {
  it("magic-user rows", () => {
    expect(spellSlots("magic-user", 1, 10)).toEqual([1, 0, 0, 0, 0]);
    expect(spellSlots("magic-user", 3, 10)).toEqual([3, 1, 0, 0, 0]);
    expect(spellSlots("magic-user", 9, 10)).toEqual([4, 3, 3, 2, 1]);
    expect(spellSlots("magic-user", 10, 10)).toEqual([4, 4, 3, 3, 2]);
  });

  it("Intelligence adds nothing to a magic-user's spells per day", () => {
    expect(spellSlots("magic-user", 1, 18)).toEqual([1, 0, 0, 0, 0]);
  });

  it("cleric rows", () => {
    expect(spellSlots("cleric", 1, 10)).toEqual([0, 0, 0, 0, 0]);
    expect(spellSlots("cleric", 4, 10)).toEqual([2, 1, 0, 0, 0]);
    expect(spellSlots("cleric", 7, 10)).toEqual([2, 2, 2, 1, 1]);
    expect(spellSlots("cleric", 10, 10)).toEqual([3, 3, 3, 3, 3]);
  });

  it("a cleric's Wisdom bonus adds 1st-level spells (WW p. 5)", () => {
    expect(spellSlots("cleric", 1, 15)).toEqual([1, 0, 0, 0, 0]);
    // Jay's ruling cleric-l1-scroll: one spell at 1st level, even with Wis 18.
    expect(spellSlots("cleric", 1, 18)).toEqual([1, 0, 0, 0, 0]);
    expect(spellSlots("cleric", 2, 18)).toEqual([3, 0, 0, 0, 0]);
    // Liz: a 4th-level Vicar with a +1 Wisdom bonus has 3 1st-level and 1 2nd-level spell.
    expect(spellSlots("cleric", 4, 16)).toEqual([3, 1, 0, 0, 0]);
  });

  it("a Wisdom penalty takes nothing away (Jay's ruling cleric-wis-penalty)", () => {
    expect(spellSlots("cleric", 2, 5)).toEqual([1, 0, 0, 0, 0]);
  });

  it("rejects levels off the table", () => {
    expect(() => spellSlots("cleric", 0, 10)).toThrow();
    expect(() => spellSlots("magic-user", 11, 10)).toThrow();
  });
});

describe("spell lists (Woundwort's Warren p. 26)", () => {
  it("has every spell on the house lists", () => {
    expect([1, 2, 3, 4, 5, 6].map((l) => spellsFor("magic-user", l).length)).toEqual([10, 12, 15, 12, 14, 12]);
    expect([1, 2, 3, 4, 5].map((l) => spellsFor("cleric", l).length)).toEqual([6, 6, 6, 6, 7]);
    expect(maxSpellLevel("magic-user")).toBe(6);
    expect(maxSpellLevel("cleric")).toBe(5);
  });

  it("keys are unique and say the class", () => {
    expect(new Set(SPELLS.map((s) => s.key)).size).toBe(SPELLS.length);
    expect(spell("mu:sleep")).toMatchObject({ name: "Sleep", cls: "magic-user", level: 1 });
    expect(spell("cl:light")).toMatchObject({ name: "Light", cls: "cleric", level: 1 });
    expect(spell("mu:light")).toMatchObject({ cls: "magic-user" });
    expect(spell("cl:silence-15-radius")).toMatchObject({ name: "Silence 15' Radius", level: 2 });
  });

  it("Snake Charm and Prayer are not on the cleric list", () => {
    expect(SPELLS.some((s) => s.name === "Snake Charm" || s.name === "Prayer")).toBe(false);
  });
});

describe("known spells (rulings cleric-all-spells, magic-user-spellbook)", () => {
  it("a cleric has every cleric spell, in list order, whatever the book says", () => {
    const all = Array.from({ length: maxSpellLevel("cleric") }, (_, i) => spellsFor("cleric", i + 1)).flat();
    expect(knownSpells("cleric", [])).toEqual(all);
    expect(knownSpells("cleric", ["mu:sleep"])).toEqual(all);
  });

  it("a magic-user has only the spells in the spellbook, in list order", () => {
    expect(knownSpells("magic-user", []).length).toBe(0);
    expect(knownSpells("magic-user", ["mu:sleep", "mu:fireball", "mu:charm-person"]).map((s) => s.key)).toEqual([
      "mu:charm-person",
      "mu:sleep",
      "mu:fireball",
    ]);
  });

  it("drops keys that aren't on the magic-user list", () => {
    expect(knownSpells("magic-user", ["cl:bless", "mu:gone", "mu:web"]).map((s) => s.key)).toEqual(["mu:web"]);
  });
});

describe("checking prepared spells", () => {
  const known = knownSpells("cleric", []);
  const slots = spellSlots("cleric", 4, 16);

  it("accepts spells that fit the slots", () => {
    expect(checkPrepared("cleric", slots, known, ["cl:cure-light-wounds", "cl:light", "cl:bless"])).toBeNull();
    expect(checkPrepared("cleric", slots, known, [])).toBeNull();
  });

  it("rejects too many at one spell level", () => {
    expect(checkPrepared("cleric", slots, known, ["cl:bless", "cl:bless"])).toMatch(/2 2nd-level spells prepared, but only 1/);
  });

  it("rejects a spell level the character has no slots for (Liz's Cure Disease)", () => {
    expect(checkPrepared("cleric", slots, known, ["cl:cure-disease"])).toMatch(/3rd-level/);
  });

  it("lets a cleric prepare any cleric spell at a level with slots", () => {
    expect(checkPrepared("cleric", slots, known, ["cl:detect-magic", "cl:light", "cl:hold-person"])).toBeNull();
  });

  it("rejects spells the character doesn't hold or from the other class", () => {
    const firstOnly = spellsFor("magic-user", 1);
    expect(checkPrepared("magic-user", spellSlots("magic-user", 3, 10), firstOnly, ["mu:web"])).toMatch(/isn't in this character's spellbook/);
    expect(checkPrepared("cleric", slots, known, ["mu:sleep"])).toMatch(/class's list/);
  });

  it("lets one spell fill several slots (Jay's ruling prepare-same-spell)", () => {
    expect(checkPrepared("magic-user", spellSlots("magic-user", 3, 10), knownSpells("magic-user", ["mu:sleep"]), ["mu:sleep", "mu:sleep", "mu:sleep"])).toBeNull();
  });
});

describe("the magic-user spellbook (ruling magic-user-spellbook)", () => {
  it("adds and removes a spell, kept in list order without repeats", () => {
    const one = setSpellbookSpell([], "mu:sleep", true);
    expect(one).toEqual(["mu:sleep"]);
    const two = setSpellbookSpell(one, "mu:charm-person", true);
    expect(two).toEqual(["mu:charm-person", "mu:sleep"]);
    expect(setSpellbookSpell(two, "mu:sleep", true)).toEqual(two);
    expect(setSpellbookSpell(two, "mu:sleep", false)).toEqual(["mu:charm-person"]);
    expect(setSpellbookSpell(["mu:fireball"], "mu:web", false)).toEqual(["mu:fireball"]);
  });

  it("takes any spell on the list, even one the character can't cast yet", () => {
    expect(setSpellbookSpell([], "mu:disintegrate", true)).toEqual(["mu:disintegrate"]);
  });

  it("drops keys that are no longer on the list", () => {
    expect(setSpellbookSpell(["mu:gone", "mu:light"], "mu:sleep", true)).toEqual(["mu:light", "mu:sleep"]);
  });

  it("refuses spells off the magic-user list", () => {
    expect(() => setSpellbookSpell([], "cl:bless", true)).toThrow(/magic-user list/);
    expect(() => setSpellbookSpell([], "mu:nope", true)).toThrow(/magic-user list/);
  });

  it("limits what a magic-user can prepare", () => {
    const book = setSpellbookSpell([], "mu:sleep", true);
    const slots = spellSlots("magic-user", 1, 10);
    expect(checkPrepared("magic-user", slots, knownSpells("magic-user", book), ["mu:sleep"])).toBeNull();
    expect(checkPrepared("magic-user", slots, knownSpells("magic-user", book), ["mu:magic-missile"])).toMatch(/Magic Missile isn't in this character's spellbook/);
    expect(checkPrepared("magic-user", slots, knownSpells("magic-user", []), ["mu:sleep"])).toMatch(/isn't in this character's spellbook/);
  });

  it("a spell taken out while prepared still passes the slot-count check", () => {
    // The sheet checks slot counts against the whole list, so the spell stays today without a warning.
    expect(checkPrepared("magic-user", spellSlots("magic-user", 1, 10), spellsFor("magic-user"), ["mu:sleep"])).toBeNull();
  });

  it("finds prepared spells no longer in the book, once each, in list order", () => {
    expect(preparedOutsideBook("magic-user", ["mu:sleep"], ["mu:sleep", "mu:web", "mu:light", "mu:web"]).map((s) => s.key)).toEqual(["mu:light", "mu:web"]);
    expect(preparedOutsideBook("magic-user", ["mu:sleep"], ["mu:sleep"])).toEqual([]);
    expect(preparedOutsideBook("cleric", [], ["cl:bless"])).toEqual([]);
  });

  it("compares books as sets", () => {
    expect(sameSpellbook(["mu:sleep", "mu:light"], ["mu:light", "mu:sleep"])).toBe(true);
    expect(sameSpellbook(["mu:sleep"], ["mu:sleep", "mu:light"])).toBe(false);
    expect(sameSpellbook([], [])).toBe(true);
  });
});
