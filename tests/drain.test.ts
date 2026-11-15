import { describe, expect, it } from "vitest";
import { planDrain, untrackedLevelsFor, type DrainInput } from "@/lib/rules/drain";

const base: DrainInput = {
  race: "human",
  cls: "fighting-man",
  xp: 16000, // 5th level (WW p. 7)
  baseHpLevel: 1,
  dice: [
    { id: "d2", level: 2, gain: 5 },
    { id: "d3", level: 3, gain: 3 },
    { id: "d4", level: 4, gain: 6 },
    { id: "d5", level: 5, gain: 4 },
  ],
  hpMax: 25,
  newXp: 8000,
  untrackedHpLost: null,
};

describe("level loss (Monsters & Treasure p. 9)", () => {
  it("a Wight's hit: one level and its hit die go", () => {
    const p = planDrain(base);
    if (typeof p === "string") throw new Error(p);
    expect(p.fromLevel).toBe(5);
    expect(p.toLevel).toBe(4);
    expect(p.lostDice.map((d) => d.id)).toEqual(["d5"]);
    expect(p.hpLost).toBe(4);
    expect(p.newHpMax).toBe(21);
    expect(p.newBaseHpLevel).toBe(1);
  });
  it("a Spectre's hit: two levels, highest first", () => {
    const p = planDrain({ ...base, newXp: 4000 });
    if (typeof p === "string") throw new Error(p);
    expect(p.toLevel).toBe(3);
    expect(p.lostDice.map((d) => d.id)).toEqual(["d5", "d4"]);
    expect(p.newHpMax).toBe(15);
  });
  it("lower XP in the same level loses no die", () => {
    const p = planDrain({ ...base, newXp: 15000, xp: 20000 });
    if (typeof p === "string") throw new Error(p);
    expect(p.fromLevel).toBe(5);
    expect(p.toLevel).toBe(4);
    const same = planDrain({ ...base, xp: 20000, newXp: 17000 });
    if (typeof same === "string") throw new Error(same);
    expect(same.toLevel).toBe(5);
    expect(same.lostDice).toEqual([]);
    expect(same.hpLost).toBe(0);
  });
  it("a reached level whose die isn't rolled yet takes nothing away", () => {
    const p = planDrain({ ...base, dice: base.dice.filter((d) => d.level < 5), hpMax: 21 });
    if (typeof p === "string") throw new Error(p);
    expect(p.lostDice).toEqual([]);
    expect(p.newHpMax).toBe(21);
  });
  it("a die that added nothing (hit-die-floor) takes nothing away", () => {
    const p = planDrain({ ...base, dice: [...base.dice.slice(0, 3), { id: "d5", level: 5, gain: null }], hpMax: 21 });
    if (typeof p === "string") throw new Error(p);
    expect(p.hpLost).toBe(0);
  });
  it("asks Jay for the hit points of imported levels with no die on record", () => {
    const imported: DrainInput = { ...base, baseHpLevel: 4, dice: [{ id: "d5", level: 5, gain: 4 }] };
    expect(untrackedLevelsFor({ ...imported, newXp: 4000 })).toEqual([4]);
    expect(planDrain({ ...imported, newXp: 4000 })).toContain("No hit die is on record for level 4");
    const p = planDrain({ ...imported, newXp: 4000, untrackedHpLost: 5 });
    if (typeof p === "string") throw new Error(p);
    expect(p.hpLost).toBe(9);
    expect(p.newHpMax).toBe(16);
    expect(p.newBaseHpLevel).toBe(3);
    // Dropping only the app-rolled level needs nothing from Jay.
    expect(untrackedLevelsFor({ ...imported, newXp: 8000 })).toEqual([]);
  });
  it("refuses XP that isn't lower, and maximum hit points below 1", () => {
    expect(planDrain({ ...base, newXp: 16000 })).toContain("has to be lower");
    expect(planDrain({ ...base, newXp: -1 })).toContain("whole number");
    expect(planDrain({ ...base, newXp: 0, hpMax: 18 })).toContain("maximum hit points to 0");
  });
  it("reads levels at the race cap", () => {
    // A halfling fighting-man stops at 5th (WW p. 7) however much XP he has.
    const p = planDrain({ ...base, race: "halfling", xp: 100000, newXp: 8000 });
    if (typeof p === "string") throw new Error(p);
    expect(p.fromLevel).toBe(5);
    expect(p.toLevel).toBe(4);
  });
});
