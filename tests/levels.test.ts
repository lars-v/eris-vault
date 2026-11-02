import { describe, expect, it } from "vitest";
import { levelFor, levelsToRoll, maxLevel } from "@/lib/rules/advancement";
import { rollLevelHp, type D6 } from "@/lib/rules/dice";

const die = (face: number): D6 => () => face;

describe("hit dice after 1st level (WW pp. 5-6)", () => {
  it("adds 1d6 with the class adjustment and the Con modifier, no 3 hp minimum", () => {
    const r = rollLevelHp("fighting-man", 1, 2, die(4));
    expect(r.total).toBe(6);
    expect(r.gain).toBe(6);
    expect(r.dice).toEqual([[4]]);
    expect(r.formula).toBe("1d6 + 1 + 1 Con, level 2");
    expect(rollLevelHp("cleric", 0, 3, die(1)).gain).toBe(1);
  });
  it("keeps a total below 1 but adds nothing until Jay rules on hit-die-floor", () => {
    const r = rollLevelHp("magic-user", -1, 2, die(1));
    expect(r.total).toBe(-1);
    expect(r.totals).toEqual([-1]);
    expect(r.gain).toBeNull();
    expect(rollLevelHp("thief", 0, 2, die(1)).gain).toBeNull();
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
  it("stops at the race's level cap and at 9th (name-level-xp is pending)", () => {
    expect(maxLevel("halfling", "fighting-man")).toBe(5);
    expect(maxLevel("elf", "fighting-man")).toBe(7);
    expect(maxLevel("dwarf", "fighting-man")).toBe(9);
    expect(maxLevel("human", "magic-user")).toBe(9);
    expect(levelsToRoll("halfling", "fighting-man", 250000, 4)).toEqual([5]);
    expect(levelsToRoll("human", "fighting-man", 10_000_000, 8)).toEqual([9]);
    expect(levelFor("fighting-man", 10_000_000).level).toBe(9);
  });
});
