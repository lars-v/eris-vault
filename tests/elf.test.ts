import { describe, expect, it } from "vitest";
import { STARTING_XP } from "@/lib/rules/creation";
import { checkXpSplit, classRecordsFor, keepsEveryClass, switchProblem, type ClassRecord } from "@/lib/rules/elf";
import { raceFeatures } from "@/lib/rules/race";
import { importFlags } from "@/lib/rules/import";

describe("an elf's two classes (WW p. 10)", () => {
  it("keeps a record for both classes, the starting one first", () => {
    expect(classRecordsFor("elf", "magic-user")).toEqual(["magic-user", "fighting-man"]);
    expect(classRecordsFor("elf", "fighting-man")).toEqual(["fighting-man", "magic-user"]);
  });
  it("gives every other race one record; halflings can't switch", () => {
    expect(classRecordsFor("halfling", "thief")).toEqual(["thief"]);
    expect(classRecordsFor("dwarf", "fighting-man")).toEqual(["fighting-man"]);
    expect(classRecordsFor("human", "cleric")).toEqual(["cleric"]);
    expect(keepsEveryClass("halfling")).toBe(false);
    expect(keepsEveryClass("elf")).toBe(true);
    expect(keepsEveryClass(null)).toBe(false);
  });
});

describe("sharing the starting XP (Jay's ruling starting-xp; table decision elf-starting-xp)", () => {
  const both = ["fighting-man", "magic-user"] as const;
  it("lets the player share 5,000 XP any way between the two classes", () => {
    expect(checkXpSplit([...both], { "fighting-man": 2000, "magic-user": 3000 }, STARTING_XP)).toEqual({
      "fighting-man": 2000,
      "magic-user": 3000,
    });
    expect(checkXpSplit([...both], { "fighting-man": 0, "magic-user": 5000 }, STARTING_XP)).toEqual({
      "fighting-man": 0,
      "magic-user": 5000,
    });
  });
  it("needs the two to add up to the total", () => {
    expect(checkXpSplit([...both], { "fighting-man": 2000, "magic-user": 2000 }, STARTING_XP)).toMatch(/add up to 5,000; these add up to 4,000/);
  });
  it("needs whole numbers, 0 or more, for both", () => {
    expect(checkXpSplit([...both], { "fighting-man": 5000 }, STARTING_XP)).toMatch(/Magic-User's XP/);
    expect(checkXpSplit([...both], { "fighting-man": NaN, "magic-user": 5000 }, STARTING_XP)).toMatch(/Fighting-Man's XP/);
    expect(checkXpSplit([...both], { "fighting-man": -1, "magic-user": 5001 }, STARTING_XP)).toMatch(/0 or more/);
    expect(checkXpSplit([...both], { "fighting-man": 2500.5, "magic-user": 2499.5 }, STARTING_XP)).toMatch(/whole number/);
  });
  it("puts everything in the one class of any other race", () => {
    expect(checkXpSplit(["thief"], {}, STARTING_XP)).toEqual({ thief: 5000 });
  });
});

describe("switching class (WW p. 10)", () => {
  const records: ClassRecord[] = [
    { id: "fm", class: "fighting-man", active: true, hpMax: 7 },
    { id: "mu", class: "magic-user", active: false, hpMax: 4 },
  ];
  it("lets an elf switch to its other class", () => {
    expect(switchProblem("elf", records, "mu")).toBeNull();
  });
  it("refuses the class already played, an unknown class, and other races", () => {
    expect(switchProblem("elf", records, "fm")).toMatch(/Already playing as a Fighting-Man/);
    expect(switchProblem("elf", records, "nope")).toBe("Unknown class");
    expect(switchProblem("halfling", records, "mu")).toMatch(/Only an elf/);
  });
  it("waits for the other class's 1st-level hit points (Jay's ruling elf-second-class-hp)", () => {
    expect(switchProblem("elf", [records[0], { ...records[1], hpMax: null }], "mu")).toMatch(/Roll the Magic-User's 1st-level hit points/);
  });
});

describe("racial features as printed", () => {
  it("gives humans none beyond their class", () => {
    expect(raceFeatures("human")).toEqual([]);
  });
  it("lists the elf's two classes with their caps and its eye for secret doors (WW pp. 10, 37)", () => {
    const text = raceFeatures("elf").map((f) => f.text).join(" ");
    expect(text).toMatch(/fighting-man up to 7th level and magic-user up to 9th level/);
    expect(text).toMatch(/secret doors and passages on 1-4 in 6/);
    expect(text).toMatch(/2 in 6 just passing within 10 feet/);
    expect(text).toMatch(/No sight in the dark/);
  });
  it("lists the dwarf's stonework, traps and gems (WW pp. 9, 37; Men & Magic p. 7)", () => {
    const f = raceFeatures("dwarf");
    expect(f[0].text).toBe("One class: fighting-man up to 10th level.");
    const text = f.map((x) => x.text).join(" ");
    expect(text).toMatch(/slanting passages, traps, shifting walls and new construction/);
    expect(text).toMatch(/traps on 1-2 in 6.*stonework traps on 4 in 6/);
    expect(text).toMatch(/value of found gems/);
    // A dwarf's sight in the dark is its own roll (Jay's ruling dwarf-darkvision), shown with these.
    expect(text).not.toMatch(/No sight in the dark/);
  });
  it("lists the halfling's one class and hurled weapons (WW p. 10)", () => {
    const text = raceFeatures("halfling").map((f) => f.text).join(" ");
    expect(text).toMatch(/fighting-man up to 5th level or thief up to 9th level/);
    expect(text).toMatch(/can't switch/);
    expect(text).toMatch(/\+1 to hit with any hurled weapon.*\+2.*1d3/);
  });
  it("cites a page for every feature", () => {
    for (const race of ["dwarf", "elf", "halfling"] as const) {
      for (const f of raceFeatures(race)) expect(f.source).toMatch(/WW p/);
    }
  });
});

describe("an imported elf", () => {
  const base = {
    alignment: "neutral" as const,
    xp: 3000,
    scores: { str: 10, int: 12, wis: 9, dex: 11, con: 10, cha: 8 },
    hpCurrent: 6,
    hpMax: 6,
    coinsGp: 0,
    items: [],
  };
  const written = { level: null, save: null, bonuses: { str: null, int: null, wis: null, dex: null, con: null, cha: null } };
  it("is flagged for the class record the sheet didn't bring", () => {
    const flags = importFlags({ ...base, race: "elf", cls: "fighting-man" }, written);
    expect(flags.find((f) => f.source === "WW p. 10")?.title).toBe("The elf's Magic-User record is missing");
  });
  it("leaves other races alone", () => {
    expect(importFlags({ ...base, race: "human", cls: "fighting-man" }, written).some((f) => f.source === "WW p. 10")).toBe(false);
  });
});
