import { describe, expect, it } from "vitest";
import { combatRows, combatRuling, toHit } from "@/lib/rules/combat";
import { levelsGained, levelUp, type LevelUpInput } from "@/lib/rules/levelup";
import { thiefSkills } from "@/lib/rules/thief";
import { canAffectUndead, turningColumn, turningRow } from "@/lib/rules/turning";

const human = (cls: LevelUpInput["cls"], extra: Partial<LevelUpInput> = {}): LevelUpInput => ({
  race: "human",
  cls,
  alignment: "lawful",
  wis: 10,
  ...extra,
});

describe("Character Combat Matrix (WW pp. 19-20)", () => {
  it("fighting-men move a row every level", () => {
    expect(toHit("fighting-man", 1, 9)).toEqual([10]);
    expect(toHit("fighting-man", 4, 9)).toEqual([7]);
    expect(toHit("fighting-man", 9, -5)).toEqual([16]);
    expect(toHit("fighting-man", 1, 0)).toEqual([19]);
  });
  it("clerics every 2 levels, and thieves use the cleric's progression", () => {
    expect(toHit("cleric", 1, 9)).toEqual([10]);
    expect(toHit("cleric", 2, 9)).toEqual([10]);
    expect(toHit("cleric", 3, 9)).toEqual([9]);
    expect(toHit("thief", 9, 9)).toEqual(toHit("cleric", 9, 9));
    expect(toHit("thief", 9, 9)).toEqual([6]);
  });
  it("magic-users as printed, with 5th and 6th level in two rows (mu-combat-rows)", () => {
    expect(combatRows("magic-user", 3).map((r) => r.row)).toEqual([1]);
    expect(combatRows("magic-user", 4).map((r) => r.row)).toEqual([2]);
    expect(combatRows("magic-user", 5).map((r) => r.row)).toEqual([2, 3]);
    expect(combatRows("magic-user", 6).map((r) => r.row)).toEqual([2, 3]);
    expect(combatRows("magic-user", 7).map((r) => r.row)).toEqual([3]);
    expect(toHit("magic-user", 5, 9)).toEqual([9, 8]);
    expect(combatRuling("magic-user", 6)).toBe("mu-combat-rows");
    expect(combatRuling("magic-user", 7)).toBeNull();
    expect(combatRuling("fighting-man", 5)).toBeNull();
  });
});

describe("Thief skills (WW p. 9)", () => {
  it("reads both tables at a level", () => {
    const l1 = Object.fromEntries(thiefSkills(1).map((s) => [s.key, s.value]));
    expect(l1).toEqual({
      "pick-pockets": "9",
      "move-silently": "10",
      "open-locks": "10",
      "remove-traps": "11",
      "hide-in-shadows": "11",
      "climb-walls": "1-4",
      "hear-noise": "1-2",
      "read-languages": null,
      "read-magic": null,
    });
    const l9 = Object.fromEntries(thiefSkills(9).map((s) => [s.key, s.value]));
    expect(l9["hide-in-shadows"]).toBe("7");
    expect(l9["read-magic"]).toBe("1-4");
    expect(l9["climb-walls"]).toBe("1-6");
  });
  it("has rows to 14th level only", () => {
    expect(thiefSkills(14)[0].value).toBe("1");
    expect(() => thiefSkills(15)).toThrow(RangeError);
  });
});

describe("Cleric Affecting Undead (WW p. 8)", () => {
  it("groups 9th to 13th level in one column", () => {
    expect(turningColumn(8)).toBe(7);
    expect(turningColumn(9)).toBe(8);
    expect(turningColumn(13)).toBe(8);
    expect(turningColumn(14)).toBe(9);
  });
  it("reads a column", () => {
    const l1 = turningRow(1);
    expect(l1.find((u) => u.name === "Skeleton")?.result).toBe(7);
    expect(l1.find((u) => u.name === "Ghast")?.result).toBeNull();
    const l4 = turningRow(4);
    expect(l4.find((u) => u.name === "Skeleton")?.result).toBe("T");
    expect(l4.find((u) => u.name === "Wraith")?.result).toBe(11);
    expect(turningRow(9).find((u) => u.name === "Lich")?.result).toBe(11);
  });
  it("neutral clerics can't affect undead", () => {
    expect(canAffectUndead("neutral")).toBe(false);
    expect(canAffectUndead("chaotic")).toBe(true);
    expect(canAffectUndead(null)).toBeNull();
  });
});

describe("levelUp", () => {
  const find = (u: ReturnType<typeof levelUp>, label: string) => u.changes.find((c) => c.label === label);

  it("lists title, save and to-hit for a fighting-man", () => {
    const u = levelUp(human("fighting-man"), 1, 2);
    expect(find(u, "Title")).toMatchObject({ before: "Veteran", after: "Warrior" });
    expect(find(u, "Saving throw")).toMatchObject({ before: "15", after: "14" });
    expect(find(u, "Roll to hit AC 9")).toMatchObject({ before: "10", after: "9" });
    expect(u.notes).toEqual([]);
  });
  it("covers a jump of several levels at once", () => {
    const u = levelUp(human("fighting-man"), 1, 4);
    expect(find(u, "Title")?.after).toBe("Hero");
    expect(find(u, "Roll to hit AC 9")).toMatchObject({ before: "10", after: "7" });
  });
  it("leaves out to-hit when the row doesn't move", () => {
    expect(find(levelUp(human("cleric"), 1, 2), "Roll to hit AC 9")).toBeUndefined();
  });
  it("names a new spell level for a magic-user, with no book to buy (ruling magic-user-all-spells)", () => {
    const u = levelUp(human("magic-user"), 2, 3);
    expect(find(u, "2nd-level spells per day")).toMatchObject({ before: "0", after: "1" });
    expect(find(u, "1st-level spells per day")).toMatchObject({ before: "2", after: "3" });
    expect(u.notes.some((n) => n.text.includes("spellbook"))).toBe(false);
  });
  it("sends an elf to no mental book study either", () => {
    const u = levelUp({ ...human("magic-user"), race: "elf" }, 2, 3);
    expect(u.notes.some((n) => n.text.includes("mental book"))).toBe(false);
  });
  it("gives a cleric new spells per day but no scroll to fetch (ruling cleric-all-spells)", () => {
    const u = levelUp(human("cleric"), 1, 2);
    expect(u.notes.some((n) => n.text.includes("prayer scroll"))).toBe(false);
    expect(find(u, "1st-level spells per day")).toMatchObject({ before: "0", after: "1" });
    const v = levelUp(human("cleric"), 3, 4);
    expect(v.notes.some((n) => n.text.includes("prayer scroll"))).toBe(false);
  });
  it("lists turning changes for a lawful cleric", () => {
    const u = levelUp(human("cleric"), 3, 4);
    expect(find(u, "Affect Skeleton")).toMatchObject({ before: "3", after: "T" });
    expect(find(u, "Affect Wraith")).toMatchObject({ before: "-", after: "11" });
  });
  it("warns about a neutral cleric reaching 4th level (neutral-cleric-fourth)", () => {
    const u = levelUp(human("cleric", { alignment: "neutral" }), 3, 4);
    expect(u.notes.map((n) => n.ruling)).toContain("neutral-cleric-fourth");
    expect(u.changes.some((c) => c.label.startsWith("Affect"))).toBe(false);
    expect(levelUp(human("cleric", { alignment: "neutral" }), 1, 2).notes.map((n) => n.ruling)).not.toContain("neutral-cleric-fourth");
  });
  it("lists thief skills that improve", () => {
    const u = levelUp(human("thief"), 1, 2);
    expect(find(u, "Move Silently")).toMatchObject({ before: "10", after: "9" });
    expect(find(u, "Read Languages")).toMatchObject({ before: "-", after: "1" });
    expect(find(u, "Pick Pockets")).toBeUndefined();
  });
  it("flags the magic-user combat misprint at 5th level", () => {
    const u = levelUp(human("magic-user"), 4, 5);
    expect(find(u, "Roll to hit AC 9")).toMatchObject({ before: "9", after: "9 or 8" });
    expect(u.notes.map((n) => n.ruling)).toContain("mu-combat-rows");
  });
  it("notes the race cap and 9th level", () => {
    expect(levelUp({ ...human("fighting-man"), race: "halfling" }, 4, 5).notes[0].text).toContain("as high as a halfling fighting-man goes");
    expect(levelUp(human("fighting-man"), 8, 9).notes.map((n) => n.ruling)).toContain("name-level-xp");
    expect(() => levelUp({ ...human("fighting-man"), race: "halfling" }, 5, 6)).toThrow(RangeError);
    expect(() => levelUp(human("fighting-man"), 3, 3)).toThrow(RangeError);
  });
});

describe("levelsGained", () => {
  it("reports the levels an award crosses, held at the cap", () => {
    expect(levelsGained("human", "fighting-man", 0, 1999)).toEqual({ from: 1, to: 1 });
    expect(levelsGained("human", "fighting-man", 0, 2000)).toEqual({ from: 1, to: 2 });
    expect(levelsGained("human", "fighting-man", 0, 5000)).toEqual({ from: 1, to: 3 });
    expect(levelsGained("halfling", "fighting-man", 10000, 100000)).toEqual({ from: 4, to: 5 });
    expect(levelsGained("human", "fighting-man", 4000, -3000)).toEqual({ from: 3, to: 1 });
  });
});
