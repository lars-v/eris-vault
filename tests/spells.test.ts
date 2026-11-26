import { describe, expect, it } from "vitest";
import {
  checkPrepared,
  knownSpells,
  maxSpellLevel,
  setSpellMark,
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

describe("known spells (rulings cleric-all-spells, magic-user-all-spells)", () => {
  it("every caster has every spell on their own class's list, in list order", () => {
    for (const cls of ["magic-user", "cleric"] as const) {
      const all = Array.from({ length: maxSpellLevel(cls) }, (_, i) => spellsFor(cls, i + 1)).flat();
      expect(knownSpells(cls)).toEqual(all);
      expect(knownSpells(cls).every((s) => s.cls === cls)).toBe(true);
    }
    expect(knownSpells("magic-user").map((s) => s.key)).toContain("mu:fireball");
    expect(knownSpells("cleric").map((s) => s.key)).not.toContain("mu:sleep");
  });
});

describe("checking prepared spells", () => {
  const known = knownSpells("cleric");
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
    expect(checkPrepared("magic-user", spellSlots("magic-user", 3, 10), knownSpells("magic-user"), ["mu:sleep", "mu:sleep", "mu:sleep"])).toBeNull();
  });
});

describe("spells a player highlights as known (a note, not a rule)", () => {
  it("adds and removes a mark, kept in list order without repeats", () => {
    const one = setSpellMark([], "mu:sleep", true);
    expect(one).toEqual(["mu:sleep"]);
    const two = setSpellMark(one, "mu:charm-person", true);
    expect(two).toEqual(["mu:charm-person", "mu:sleep"]);
    expect(setSpellMark(two, "mu:sleep", true)).toEqual(two);
    expect(setSpellMark(two, "mu:sleep", false)).toEqual(["mu:charm-person"]);
    expect(setSpellMark(["mu:fireball"], "mu:web", false)).toEqual(["mu:fireball"]);
  });

  it("drops keys that are no longer on the list", () => {
    expect(setSpellMark(["mu:gone", "mu:light"], "mu:sleep", true)).toEqual(["mu:light", "mu:sleep"]);
  });

  it("refuses spells off the magic-user list", () => {
    expect(() => setSpellMark([], "cl:bless", true)).toThrow(/magic-user list/);
    expect(() => setSpellMark([], "mu:nope", true)).toThrow(/magic-user list/);
  });

  it("never limits what a magic-user can prepare (ruling magic-user-all-spells)", () => {
    const marked = setSpellMark([], "mu:sleep", true);
    expect(marked).not.toContain("mu:magic-missile");
    expect(checkPrepared("magic-user", spellSlots("magic-user", 1, 10), knownSpells("magic-user"), ["mu:magic-missile"])).toBeNull();
  });
});
