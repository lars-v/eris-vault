import { describe, expect, it } from "vitest";
import { abilityModifier } from "@/lib/rules/abilities";
import { levelFor, RACE_CLASSES } from "@/lib/rules/advancement";

describe("ability modifiers (Woundwort's Warren p. 5)", () => {
  it.each([
    [3, -2],
    [4, -1],
    [6, -1],
    [7, 0],
    [14, 0],
    [15, 1],
    [17, 1],
    [18, 2],
  ])("score %i gives %i", (score, mod) => {
    expect(abilityModifier(score)).toBe(mod);
  });

  it("rejects scores outside 3d6", () => {
    expect(() => abilityModifier(2)).toThrow();
    expect(() => abilityModifier(19)).toThrow();
  });
});

describe("advancement tables (Woundwort's Warren pp. 7-9)", () => {
  it("Liz: cleric with 7,420 XP is a 4th-level Vicar, save 10, next Curate at 12,000", () => {
    const info = levelFor("cleric", 7420);
    expect(info).toMatchObject({ level: 4, title: "Vicar", save: 10, nextTitle: "Curate", nextXp: 12000 });
  });

  it("thresholds are inclusive", () => {
    expect(levelFor("thief", 1249).level).toBe(1);
    expect(levelFor("thief", 1250).level).toBe(2);
    expect(levelFor("magic-user", 100000)).toMatchObject({ level: 9, title: "Sorcerer", pastNine: true });
    expect(levelFor("fighting-man", 0)).toMatchObject({ level: 1, title: "Veteran", save: 15 });
  });

  it("stops at 9th until the name-level XP ruling is made", () => {
    expect(levelFor("cleric", 999999).level).toBe(9);
  });

  it("race and class limits", () => {
    expect(RACE_CLASSES.dwarf).toEqual({ "fighting-man": 10 });
    expect(RACE_CLASSES.halfling).toEqual({ "fighting-man": 5, thief: 9 });
    expect(RACE_CLASSES.elf).toEqual({ "fighting-man": 7, "magic-user": 9 });
    expect(Object.keys(RACE_CLASSES.human)).toHaveLength(4);
  });
});
