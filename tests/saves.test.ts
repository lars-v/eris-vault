import { describe, expect, it } from "vitest";
import { acceptableTotals, againstText, bonusText, overlappingForms, parseAgainst, saveBonusesFor } from "@/lib/rules/saves";

describe("Saving Throw Bonuses (WW p. 21)", () => {
  it("lists the class row, then the race rows", () => {
    expect(saveBonusesFor("thief", "halfling").map((b) => `${b.who} ${bonusText(b)}`)).toEqual([
      "Thief +2 vs death and poison",
      "Halfling +4 vs magic",
      "Halfling +1 vs death and poison",
    ]);
    expect(saveBonusesFor("fighting-man", "human").map(bonusText)).toEqual(["+1 vs death and poison"]);
    expect(saveBonusesFor("cleric", "human").map(bonusText)).toEqual(["+2 vs poison and paralysis"]);
    expect(saveBonusesFor("magic-user", "elf").map(bonusText)).toEqual(["+2 vs magic", "+2 vs magic"]);
    expect(saveBonusesFor("fighting-man", "dwarf").map(bonusText)).toEqual(["+1 vs death and poison", "+4 vs magic", "+1 vs death and poison"]);
  });

  it("names where class and race overlap, without adding them (save-bonus-stacking)", () => {
    expect(overlappingForms(saveBonusesFor("thief", "halfling"))).toEqual(["death", "poison"]);
    expect(overlappingForms(saveBonusesFor("magic-user", "elf"))).toEqual(["magic"]);
    expect(overlappingForms(saveBonusesFor("cleric", "human"))).toEqual([]);
    expect(overlappingForms(saveBonusesFor("cleric", "dwarf"))).toEqual(["poison"]);
  });

  it("accepts either bonus alone or both together while stacking is open", () => {
    expect(acceptableTotals("thief", "halfling", "death")).toEqual([1, 2, 3]);
    expect(acceptableTotals("thief", "halfling", "magic")).toEqual([4]);
    expect(acceptableTotals("thief", "halfling", "paralysis")).toEqual([]);
    expect(acceptableTotals("magic-user", "elf", "magic")).toEqual([2, 4]);
  });

  it("reads the against box only in WW's words", () => {
    expect(parseAgainst("death & poison")).toEqual(["death", "poison"]);
    expect(parseAgainst("vs. Magic")).toEqual(["magic"]);
    expect(parseAgainst("poison/paralyzation")).toEqual(["poison", "paralysis"]);
    expect(parseAgainst("wands")).toBeNull();
    expect(againstText(["poison", "death"])).toBe("death and poison");
    expect(againstText(["death", "poison", "magic"])).toBe("death, poison and magic");
  });
});
