import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { changedFromSheet, importFlags, type ImportedCharacter } from "@/lib/rules/import";
import { draftFromFields, matchCatalog, parseAlignment, parseClass, readPdfFields, sniffSheetType, toInt } from "@/lib/sheets";

// Field names and values as they appear on the Planet Eris fillable sheet (Raz, Aug 2026).
const RAZ = {
  "CHARACTER NAME": "Raz",
  CLASS: "Thief",
  RACE: "Halfling",
  ALIGNMENT: "Neutral",
  LEVEL: "4",
  "Base Save": "11",
  STR: "10",
  INT: "12",
  WIS: "11",
  DEX: "13",
  CON: "10",
  CHR: "8",
  "STR Bonus": "0",
  "CHR Bonus": "0",
  "save bonus 1": "+2",
  AGAINST_1: "death & poison",
  EncItem1: "leather armor",
  EncVal1: "1",
  EncItem4: "short sword ",
  EncVal4: "1",
  EncItem10: "thieves tools and picks",
  EncVal10: "1",
  EncItem2: "tinderbox",
  EncVal2: "0",
  CurrentHP: "8",
  MaxHP: "8",
  XP: "5000",
  ThiefPickPockets: "8",
  ThiefClimbWalls: "1-5",
  WeaponRow1: "short sword",
  DamageRow1: "1d6-1",
  MeleeRangedRow1: "m",
};

const base: ImportedCharacter = {
  race: "human",
  cls: "cleric",
  alignment: "lawful",
  xp: 3000,
  scores: { str: 8, int: 9, wis: 16, dex: 11, con: 10, cha: 15 },
  hpCurrent: 13,
  hpMax: 18,
  coinsGp: 40,
  items: [],
};
const nothingWritten = { level: null, save: null, bonuses: { str: null, int: null, wis: null, dex: null, con: null, cha: null } };

describe("reading uploaded sheets", () => {
  it("knows a file by its first bytes", () => {
    expect(sniffSheetType(new TextEncoder().encode("%PDF-1.7 ..."))).toBe("application/pdf");
    expect(sniffSheetType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(sniffSheetType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffSheetType(new TextEncoder().encode("<html><script>"))).toBeNull();
  });

  it("reads whole numbers the way sheets write them", () => {
    expect(toInt("+2")).toBe(2);
    expect(toInt("-15")).toBe(-15);
    expect(toInt("−15")).toBe(-15);
    expect(toInt("7,420")).toBe(7420);
    expect(toInt("1-5")).toBeNull();
    expect(toInt("")).toBeNull();
  });

  it("reads class and alignment words", () => {
    expect(parseClass("Fighting-Man")).toBe("fighting-man");
    expect(parseClass("Magic User")).toBe("magic-user");
    expect(parseClass("Ranger")).toBeNull();
    expect(parseAlignment("L")).toBe("lawful");
    expect(parseAlignment("Chaotic")).toBe("chaotic");
  });

  it("matches gear to the price list only when the name is clear", () => {
    expect(matchCatalog("short sword ")?.key).toBe("short-sword");
    expect(matchCatalog("mace +2")?.key).toBe("mace");
    expect(matchCatalog("torches (6)")?.key).toBe("torches");
    expect(matchCatalog("holy symbol silver")?.key).toBe("holy-symbol-silver");
    expect(matchCatalog("rope")).toBeNull(); // hemp or silk
  });

  it("maps the Planet Eris sheet", () => {
    const d = draftFromFields(RAZ);
    expect(d).toMatchObject({ name: "Raz", race: "halfling", cls: "thief", alignment: "neutral", xp: 5000, hpCurrent: 8, hpMax: 8 });
    expect(d.scores).toEqual({ str: 10, int: 12, wis: 11, dex: 13, con: 10, cha: 8 });
    expect(d.written).toMatchObject({ level: 4, save: 11 });
    // Rows keep their sheet order and the units written beside them.
    expect(d.items.map((i) => [i.name, i.encUnits])).toEqual([
      ["leather armor", 1],
      ["tinderbox", 0],
      ["short sword", 1],
      ["thieves tools and picks", 1],
    ]);
    expect(d.notes).toContain("Save bonus: +2 vs death & poison");
    expect(d.notes).toContain("Thief skills: Pick pockets 8, Climb walls 1-5");
    expect(d.notes).toContain("Weapons: short sword (1d6-1, m)");
  });

  it("marks +N gear as magic", () => {
    const d = draftFromFields({ EncItem1: "plate mail +2", EncVal1: "0" });
    expect(d.items[0]).toMatchObject({ isMagic: true, magicBonus: 2, catalogKey: "plate-mail" });
  });

  it("maps the generic OD&D sheet", () => {
    const d = draftFromFields({
      "CHARACTER NAME": "Brannoc",
      CLASS: "Fighter",
      RACE: "Dwarf",
      ALIGNMENT: "Law",
      "Hit Points": "6/9",
      "WEAPONS AND EQUIPMENT A": "battle axe\nchain mail",
      "MAGIC ITEMS A": "ring of protection",
      "TREASURE A": "40 gp",
    });
    expect(d).toMatchObject({ race: "dwarf", cls: "fighting-man", alignment: "lawful", hpCurrent: 6, hpMax: 9 });
    expect(d.items.map((i) => [i.name, i.encUnits, i.isMagic])).toEqual([
      ["battle axe", null, false],
      ["chain mail", null, false],
      ["ring of protection", null, true],
    ]);
    expect(d.notes).toContain("Treasure: 40 gp");
  });

  it("reads the form fields of a fillable PDF", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const form = doc.getForm();
    for (const [name, value] of [
      ["CHARACTER NAME", "Raz"],
      ["STR", "10"],
      ["EncItem1", ""],
    ]) {
      const f = form.createTextField(name);
      if (value) f.setText(value);
      f.addToPage(page);
    }
    const fields = await readPdfFields(await doc.save());
    expect(fields).toEqual({ "CHARACTER NAME": "Raz", STR: "10" });
  });

  it("returns no fields for a file it can't read", async () => {
    expect(await readPdfFields(new TextEncoder().encode("%PDF-broken"))).toEqual({});
  });
});

describe("checking an imported character (WW pp. 5, 7-10)", () => {
  it("a sheet that matches the books has no flags", () => {
    const written = { level: 3, save: 11, bonuses: { str: 0, int: 0, wis: 1, dex: 0, con: 0, cha: 1 } };
    expect(importFlags(base, written)).toEqual([]);
  });

  it("flags a level that doesn't match the XP, and a stale save", () => {
    const flags = importFlags({ ...base, xp: 7420 }, { ...nothingWritten, level: 3, save: 11 });
    expect(flags.map((f) => f.title)).toEqual(["Level says 3; XP says 4", "Base save says 11; the table says 10"]);
    expect(flags[0].source).toBe("WW p. 8");
  });

  it("flags written ability bonuses that don't match the scores", () => {
    const flags = importFlags(base, { ...nothingWritten, bonuses: { ...nothingWritten.bonuses, wis: 2 } });
    expect(flags[0]).toMatchObject({ title: "Ability bonuses don't match the scores", source: "WW p. 5" });
    expect(flags[0].body).toContain("Wisdom 16 is +1");
  });

  it("flags race, class and alignment the house rules don't allow", () => {
    expect(importFlags({ ...base, race: "dwarf" }, nothingWritten)[0].title).toBe("A dwarf can't be a Cleric");
    expect(importFlags({ ...base, cls: "thief", alignment: "lawful" }, nothingWritten)[0].title).toBe("Thief alignment");
    const capped = importFlags({ ...base, race: "halfling", cls: "fighting-man", xp: 32000 }, nothingWritten);
    expect(capped[0].title).toBe("Past the halfling level limit");
  });

  it("flags negative gold, hit points over maximum and gear outside class limits", () => {
    const flags = importFlags(
      { ...base, cls: "thief", alignment: "neutral", coinsGp: -15, hpCurrent: 20, items: [{ name: "shield", catalogKey: "shield" }] },
      nothingWritten,
    );
    expect(flags.map((f) => f.title)).toEqual(["Hit points above maximum", "Negative gold", "Gear outside class limits"]);
  });

  it("reads the page 1 weapon table, save bonus boxes and to-hit row", () => {
    const d = draftFromFields({ ...RAZ, SizeRow1: "S", WeaponRow2: "dagger", SizeRow2: "S", DamageRow2: "1d6-1", MeleeRangedRow2: "M/R", SRow2: "1-10", MRow2: "11-20", LRow2: "21-30", ac9: "11", ac0: "20" });
    expect(d.written.saveBonuses).toEqual([{ bonus: 2, against: "death & poison" }]);
    expect(d.written.weapons?.[1]).toEqual({ name: "dagger", size: "S", damage: "1d6-1", meleeRanged: "M/R", ranges: ["1-10", "11-20", "21-30"] });
    expect(d.written.toHit).toEqual([11, null, null, null, null, null, null, null, null, 20]);
    expect(d.notes).toContain("Weapons: short sword (S, 1d6-1, m); dagger (S, 1d6-1, M/R, range 1-10 / 11-20 / 21-30)");
  });

  it("Raz's sheet: weapons match WW p. 19, but the +4 vs magic is missing (WW p. 21)", () => {
    const raz: ImportedCharacter = { ...base, race: "halfling", cls: "thief", alignment: "neutral", xp: 5000, scores: { str: 10, int: 12, wis: 11, dex: 13, con: 10, cha: 8 } };
    const written = {
      ...nothingWritten,
      saveBonuses: [{ bonus: 2, against: "death & poison" }],
      weapons: [
        { name: "short sword", size: "S", damage: "1d6-1", meleeRanged: "m", ranges: ["", "", ""] as [string, string, string] },
        { name: "dagger", size: "S", damage: "1d6-1", meleeRanged: "M/R", ranges: ["1-10", "11-20", "21-30"] as [string, string, string] },
      ],
    };
    const flags = importFlags(raz, written);
    expect(flags.map((f) => f.title)).toEqual(["Save bonuses differ from the book"]);
    expect(flags[0].body).toBe(
      "The sheet gives +2 vs death; WW p. 21 gives +3. The sheet gives +2 vs poison; WW p. 21 gives +3. The sheet has no bonus vs magic; WW p. 21 gives +4. Class and race bonuses add together (Jay's ruling).",
    );
  });

  it("flags save bonuses the book doesn't give, and boxes it can't read", () => {
    const flags = importFlags(base, { ...nothingWritten, saveBonuses: [{ bonus: 3, against: "poison & paralysis" }, { bonus: 1, against: "wands" }] });
    expect(flags[0].body).toBe('The sheet gives +3 vs poison; WW p. 21 gives +2. The sheet gives +3 vs paralysis; WW p. 21 gives +2. Couldn\'t read "+1 vs wands".');
  });

  it("flags a to-hit row that doesn't match the Combat Matrix (WW p. 20)", () => {
    const ok = Array.from({ length: 10 }, (_, i) => 9 + i);
    expect(importFlags(base, { ...nothingWritten, toHit: ok })).toEqual([]);
    const flags = importFlags(base, { ...nothingWritten, toHit: [10, ...ok.slice(1)] });
    expect(flags[0]).toMatchObject({ title: "To-hit row doesn't match the Combat Matrix", source: "WW p. 20" });
    expect(flags[0].body).toContain("A level 3 Cleric needs 9, 10, 11, 12, 13, 14, 15, 16, 17, 18");
  });

  it("flags weapon rows that differ from WW p. 19", () => {
    const row = (name: string, size: string, damage: string, meleeRanged = "", ranges: [string, string, string] = ["", "", ""]) => ({ name, size, damage, meleeRanged, ranges });
    const flags = importFlags(
      { ...base, scores: { ...base.scores, str: 16 } },
      {
        ...nothingWritten,
        weapons: [
          row("mace +1", "N", "1d6+2"),
          row("long sword", "S", "1d8"),
          row("spear", "N", "1d6", "M/R", ["1-10", "11-20", "21-30"]),
          row("sword +1", "", "1d6"),
        ],
      },
    );
    expect(flags[0].title).toBe("Weapon table differs from the book");
    expect(flags[0].body).toBe(
      "long sword: size says S; WW p. 19 lists it as normal. long sword: damage says 1d8; WW p. 19 gives 1d6, plus Strength +1 in melee. " +
        "spear: ranges say 1-10 / 11-20 / 21-30; WW p. 19 prints 1-20 / 21-40 / 41-60. Not on the WW p. 19 damage table: sword +1.",
    );
  });

  it("lists what the player changed from the sheet", () => {
    const flag = changedFromSheet([
      { label: "XP", sheet: 5000, entered: 7420 },
      { label: "STR", sheet: 10, entered: 10 },
      { label: "Gold", sheet: null, entered: 40 },
    ]);
    expect(flag?.body).toBe("XP: sheet says 5000, player entered 7420.");
    expect(changedFromSheet([{ label: "STR", sheet: 10, entered: 10 }])).toBeNull();
  });
});
