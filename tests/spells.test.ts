import { describe, expect, it } from "vitest";
import {
  checkPrepared,
  knownSpells,
  maxSpellLevel,
  repeatedSpells,
  spell,
  SPELLS,
  spellSlots,
  spellsFor,
  startingSpells,
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
    expect(spellSlots("cleric", 1, 18)).toEqual([2, 0, 0, 0, 0]);
    // Liz: a 4th-level Vicar with a +1 Wisdom bonus has 3 1st-level and 1 2nd-level spell.
    expect(spellSlots("cleric", 4, 16)).toEqual([3, 1, 0, 0, 0]);
  });

  it("a Wisdom penalty takes nothing away while the ruling is pending", () => {
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

describe("starting and known spells (Woundwort's Warren p. 25)", () => {
  it("magic-users start with every 1st-level spell; clerics with none", () => {
    expect(startingSpells("magic-user")).toHaveLength(10);
    expect(startingSpells("cleric")).toEqual([]);
  });

  it("adds what Jay recorded, ignores other classes' keys and unknown keys", () => {
    const known = knownSpells("magic-user", ["mu:web", "cl:bless", "mu:nope"]).map((s) => s.key);
    expect(known).toContain("mu:sleep");
    expect(known).toContain("mu:web");
    expect(known).not.toContain("cl:bless");
    expect(known).toHaveLength(11);
  });
});

describe("checking prepared spells", () => {
  const known = knownSpells("cleric", ["cl:cure-light-wounds", "cl:light", "cl:bless"]);
  const slots = spellSlots("cleric", 4, 16);

  it("accepts spells that fit the slots", () => {
    expect(checkPrepared("cleric", slots, known, ["cl:cure-light-wounds", "cl:light", "cl:bless"])).toBeNull();
    expect(checkPrepared("cleric", slots, known, [])).toBeNull();
  });

  it("rejects too many at one spell level", () => {
    expect(checkPrepared("cleric", slots, known, ["cl:bless", "cl:bless"])).toMatch(/2 2nd-level spells prepared, but only 1/);
  });

  it("rejects a spell level the character has no slots for (Liz's Cure Disease)", () => {
    const withCd = knownSpells("cleric", ["cl:cure-disease"]);
    expect(checkPrepared("cleric", slots, withCd, ["cl:cure-disease"])).toMatch(/3rd-level/);
  });

  it("rejects spells the character doesn't hold or from the other class", () => {
    expect(checkPrepared("cleric", slots, known, ["cl:detect-magic"])).toMatch(/isn't in this character's prayer scrolls/);
    expect(checkPrepared("cleric", slots, known, ["mu:sleep"])).toMatch(/class's list/);
  });

  it("lists spells prepared twice", () => {
    expect(repeatedSpells(["mu:sleep", "mu:light", "mu:sleep"])).toEqual(["Sleep"]);
    expect(repeatedSpells(["mu:sleep"])).toEqual([]);
  });
});
