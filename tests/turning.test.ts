import { describe, expect, it } from "vitest";
import { turningGroups, UNDEAD } from "@/lib/rules/turning";

const names = (xs: { name: string }[]) => xs.map((x) => x.name);

describe("turningGroups (WW p. 8)", () => {
  it("sorts a 1st-level cleric's row", () => {
    const g = turningGroups(1);
    expect(g.dispel).toEqual([]);
    expect(g.turn).toEqual([]);
    expect(g.roll).toEqual([
      { name: "Skeleton", hd: 1, needed: 7 },
      { name: "Zombie", hd: 2, needed: 9 },
      { name: "Ghoul", hd: 3, needed: 11 },
    ]);
    expect(names(g.none)).toEqual(["Ghast", "Wight", "Wraith", "Mummy", "Spectre", "Vampire", "Ghost", "Lich"]);
  });

  it("sorts a 6th-level cleric's row", () => {
    const g = turningGroups(6);
    expect(names(g.dispel)).toEqual(["Skeleton"]);
    expect(names(g.turn)).toEqual(["Zombie", "Ghoul"]);
    expect(g.roll.map((r) => [r.name, r.needed])).toEqual([
      ["Ghast", 3],
      ["Wight", 5],
      ["Wraith", 7],
      ["Mummy", 9],
      ["Spectre", 11],
    ]);
    expect(names(g.none)).toEqual(["Vampire", "Ghost", "Lich"]);
  });

  it("uses the 9-13 and 14+ columns", () => {
    expect(turningGroups(9)).toEqual(turningGroups(13));
    const g = turningGroups(14);
    expect(g.none).toEqual([]);
    expect(names(g.roll)).toEqual(["Spectre", "Vampire", "Ghost", "Lich"]);
  });

  it("puts every undead type in exactly one group", () => {
    for (let level = 1; level <= 20; level++) {
      const g = turningGroups(level);
      expect(g.dispel.length + g.turn.length + g.roll.length + g.none.length).toBe(UNDEAD.length);
    }
  });
});

describe("Ashan's patronage (Jay's ruling ashan-patronage)", () => {
  it("gives +1 to turning rolls for a cleric of Ashan", async () => {
    const { patronTurnBonus } = await import("@/lib/rules/turning");
    expect(patronTurnBonus("Ashan")).toBe(1);
    expect(patronTurnBonus(" ashan ")).toBe(1);
    expect(patronTurnBonus("Diana")).toBe(0);
    expect(patronTurnBonus(null)).toBe(0);
  });
});
