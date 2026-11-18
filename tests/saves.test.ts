import { describe, expect, it } from "vitest";
import { againstText, bonusText, overlappingForms, parseAgainst, saveBonusesFor, saveTotal } from "@/lib/rules/saves";

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

  it("names where class and race overlap", () => {
    expect(overlappingForms(saveBonusesFor("thief", "halfling"))).toEqual(["death", "poison"]);
    expect(overlappingForms(saveBonusesFor("magic-user", "elf"))).toEqual(["magic"]);
    expect(overlappingForms(saveBonusesFor("cleric", "human"))).toEqual([]);
    expect(overlappingForms(saveBonusesFor("cleric", "dwarf"))).toEqual(["poison"]);
  });

  it("adds class and race bonuses together (Jay's ruling save-bonus-stacking)", () => {
    expect(saveTotal("thief", "halfling", "death")).toBe(3);
    expect(saveTotal("thief", "halfling", "magic")).toBe(4);
    expect(saveTotal("thief", "halfling", "paralysis")).toBe(0);
    expect(saveTotal("magic-user", "elf", "magic")).toBe(4);
    expect(saveTotal("fighting-man", "dwarf", "poison")).toBe(2);
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
