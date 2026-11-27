import { describe, expect, it } from "vitest";
import { fixedHpLevel, levelFor, levelsToRoll, maxLevel, NAME_LEVEL_HP } from "@/lib/rules/advancement";
import { rollLevelHp, type D6 } from "@/lib/rules/dice";

const die = (face: number): D6 => () => face;

describe("hit dice after 1st level (WW pp. 5-6)", () => {
  it("adds 1d6 with the class adjustment and the Con modifier, no 3 hp minimum", () => {
    const r = rollLevelHp("fighting-man", 1, 2, die(4));
    expect(r.total).toBe(6);
    expect(r.gain).toBe(6);
    expect(r.dice).toEqual([[4]]);
    expect(r.formula).toBe("Fighting-Man: 1d6 + 1 + 1 Con, level 2, minimum 1");
    expect(rollLevelHp("cleric", 0, 3, die(1)).gain).toBe(1);
  });
  it("adds at least 1 even when the total is below 1 (Jay's ruling hit-die-floor)", () => {
    const r = rollLevelHp("magic-user", -1, 2, die(1));
    expect(r.total).toBe(-1);
    expect(r.totals).toEqual([-1]);
    expect(r.gain).toBe(1);
    expect(rollLevelHp("thief", 0, 2, die(1)).gain).toBe(1);
  });
});

describe("levels to roll (WW pp. 6-10)", () => {
  it("lists each level the XP reaches above the hit points already counted", () => {
    expect(levelsToRoll("human", "fighting-man", 0, 1)).toEqual([]);
    expect(levelsToRoll("human", "fighting-man", 2000, 1)).toEqual([2]);
    expect(levelsToRoll("human", "fighting-man", 8000, 1)).toEqual([2, 3, 4]);
    expect(levelsToRoll("human", "fighting-man", 8000, 3)).toEqual([4]);
    expect(levelsToRoll("human", "thief", 5000, 1)).toEqual([2, 3, 4]);
  });
  it("waits for the 1st-level roll", () => {
    expect(levelsToRoll("human", "cleric", 3000, 0)).toEqual([]);
  });
  it("stops at the race's level cap and at 10th (past-tenth-level is pending)", () => {
    expect(maxLevel("halfling", "fighting-man")).toBe(5);
    expect(maxLevel("elf", "fighting-man")).toBe(7);
    expect(maxLevel("elf", "magic-user")).toBe(9);
    expect(maxLevel("dwarf", "fighting-man")).toBe(10);
    expect(maxLevel("human", "magic-user")).toBe(10);
    expect(levelsToRoll("halfling", "fighting-man", 250000, 4)).toEqual([5]);
    expect(levelsToRoll("human", "fighting-man", 10_000_000, 8)).toEqual([9, 10]);
    expect(levelFor("fighting-man", 10_000_000).level).toBe(10);
  });
});

describe("10th level (WW pp. 7-9; Jay's ruling name-level-xp)", () => {
  it("needs 100,000 more XP than 9th", () => {
    expect(levelFor("fighting-man", 349_999).level).toBe(9);
    expect(levelFor("fighting-man", 350_000)).toMatchObject({ level: 10, title: "Lord", save: 6, nextXp: null });
    expect(levelFor("magic-user", 200_000)).toMatchObject({ level: 10, title: "Wizard", save: 5 });
    expect(levelFor("cleric", 300_000)).toMatchObject({ level: 10, title: "Patriarch", save: 4 });
    expect(levelFor("thief", 250_000)).toMatchObject({ level: 10, title: "Master Thief", save: 5 });
    expect(levelFor("fighting-man", 250_000).nextXp).toBe(350_000);
  });
  it("marks XP that would reach 11th as 10+", () => {
    expect(levelFor("thief", 349_999).pastTen).toBe(false);
    expect(levelFor("thief", 350_000).pastTen).toBe(true);
  });
  it("adds a fixed amount instead of a die", () => {
    expect(fixedHpLevel(9)).toBe(false);
    expect(fixedHpLevel(10)).toBe(true);
    expect(NAME_LEVEL_HP).toEqual({ "fighting-man": 3, cleric: 2, "magic-user": 1, thief: 1 });
  });
});

describe("XP can't drop below a rolled hit die (WW p. 6)", () => {
  it("refuses XP whose level is below the highest hit die rolled", async () => {
    const { xpBelowRolledLevel } = await import("@/lib/rules/advancement");
    expect(xpBelowRolledLevel("fighting-man", 4000, 3)).toBeNull();
    expect(xpBelowRolledLevel("fighting-man", 3999, 3)).toContain("hit points rolled for level 3");
    expect(xpBelowRolledLevel("thief", 0, 0)).toBeNull();
  });
});

describe("a dwarf's sight in the dark (WW p. 10; Jay's ruling dwarf-darkvision)", () => {
  it("sees in the dark on a 1 or 2", async () => {
    const { rollDarkSight } = await import("@/lib/rules/dice");
    expect([1, 2, 3, 4, 5, 6].map((f) => rollDarkSight(die(f)).sees)).toEqual([true, true, false, false, false, false]);
    expect(rollDarkSight(die(2))).toMatchObject({ dice: [[2]], totals: [2] });
  });
});
