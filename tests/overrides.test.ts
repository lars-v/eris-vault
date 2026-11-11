import { describe, expect, it } from "vitest";
import { can, type Viewer } from "@/lib/roles";
import {
  applyHpChange,
  checkCoins,
  mergeManual,
  overrideOpen,
  planOverride,
  playStateOpen,
  type OverrideCurrent,
  type OverrideInput,
  type OverridePlan,
} from "@/lib/rules/overrides";

const player: Viewer = { userId: "p1", role: "player", status: "active", railwayAdmin: false };
const gm: Viewer = { userId: "jay", role: "gm", status: "active", railwayAdmin: false };
const admin: Viewer = { userId: "lars", role: "admin", status: "active", railwayAdmin: true };
const blockedGm: Viewer = { userId: "jay", role: "gm", status: "blocked", railwayAdmin: false };

describe("who can set stats by hand", () => {
  it("Jay and admins can; players and blocked accounts can't", () => {
    expect(can.overrideStats(gm)).toBe(true);
    expect(can.overrideStats(admin)).toBe(true);
    expect(can.overrideStats(player)).toBe(false);
    expect(can.overrideStats(blockedGm)).toBe(false);
  });
  it("only on submitted or approved characters; drafts use the build wizard", () => {
    expect(overrideOpen("submitted")).toBe(true);
    expect(overrideOpen("approved")).toBe(true);
    expect(overrideOpen("draft")).toBe(false);
  });
});

describe("when hit points and coins can be tracked", () => {
  it("players once Jay approves; staff once submitted; nobody on a draft", () => {
    expect(playStateOpen("approved", false)).toBe(true);
    expect(playStateOpen("submitted", false)).toBe(false);
    expect(playStateOpen("draft", false)).toBe(false);
    expect(playStateOpen("submitted", true)).toBe(true);
    expect(playStateOpen("draft", true)).toBe(false);
  });
});

describe("hit point changes", () => {
  const hp = { current: 6, max: 10 };
  it("damage subtracts and may go below 0", () => {
    expect(applyHpChange(hp, { mode: "damage", amount: 4 }, false)).toBe(2);
    expect(applyHpChange(hp, { mode: "damage", amount: 9 }, false)).toBe(-3);
  });
  it("healing stops at the maximum", () => {
    expect(applyHpChange(hp, { mode: "heal", amount: 2 }, false)).toBe(8);
    expect(applyHpChange(hp, { mode: "heal", amount: 50 }, false)).toBe(10);
  });
  it("healing never lowers hit points that are already above the maximum", () => {
    expect(applyHpChange({ current: 12, max: 10 }, { mode: "heal", amount: 1 }, false)).toBe(12);
  });
  it("players can't set above the maximum; Jay can", () => {
    expect(applyHpChange(hp, { mode: "set", amount: 11 }, false)).toMatch(/maximum of 10/);
    expect(applyHpChange(hp, { mode: "set", amount: 11 }, true)).toBe(11);
    expect(applyHpChange(hp, { mode: "set", amount: 10 }, false)).toBe(10);
  });
  it("refuses amounts that aren't whole, positive numbers, and the input limits", () => {
    expect(applyHpChange(hp, { mode: "damage", amount: 0 }, false)).toMatch(/1 or more/);
    expect(applyHpChange(hp, { mode: "heal", amount: 1.5 }, false)).toMatch(/whole number/);
    expect(applyHpChange(hp, { mode: "damage", amount: NaN }, false)).toMatch(/whole number/);
    expect(applyHpChange(hp, { mode: "set", amount: -100 }, true)).toMatch(/below -99/);
    expect(applyHpChange(hp, { mode: "nope" as "set", amount: 1 }, true)).toMatch(/damage, heal or set/);
  });
});

describe("coins", () => {
  it("gold may be a debt; silver and copper may not go below 0", () => {
    expect(checkCoins({ gp: -15, sp: 0, cp: 3 })).toEqual({ gp: -15, sp: 0, cp: 3 });
    expect(checkCoins({ gp: 0, sp: -1, cp: 0 })).toMatch(/Silver/);
    expect(checkCoins({ gp: 0, sp: 0, cp: -1 })).toMatch(/Copper/);
    expect(checkCoins({ gp: 1.5, sp: 0, cp: 0 })).toMatch(/whole numbers/);
  });
});

describe("overrides", () => {
  const cur: OverrideCurrent = {
    str: 9, int: 12, wis: 8, dex: 14, con: 10, cha: 7,
    name: "Liz",
    alignment: "neutral",
    deity: null,
    hpMax: 6,
    classes: [{ id: "k1", class: "thief", xp: 1300, highestHitDie: 2 }],
  };
  const same = (): OverrideInput => ({
    str: 9, int: 12, wis: 8, dex: 14, con: 10, cha: 7,
    name: "Liz",
    alignment: "neutral",
    deity: "",
    hpMax: 6,
    xp: { k1: 1300 },
  });
  const plan = (input: OverrideInput) => planOverride(cur, input, "thief");

  it("refuses a save that changes nothing", () => {
    expect(plan(same())).toBe("Nothing changed.");
  });
  it("lists each change and marks abilities and maximum hit points as hand-set", () => {
    const p = plan({ ...same(), str: 13, hpMax: 9, deity: "Ashan", xp: { k1: 2600 } }) as OverridePlan;
    expect(p.changes.map((c) => c.field)).toEqual(["deity", "str", "hpMax", "xp:thief"]);
    expect(p.set).toEqual({ deity: "Ashan", str: 13, hpMax: 9 });
    expect(p.xp).toEqual({ k1: 2600 });
    expect(p.manual).toEqual(["str", "hpMax"]);
  });
  it("keeps abilities within 3d6 (WW p. 5) until the ability-range ruling", () => {
    expect(plan({ ...same(), str: 19 })).toMatch(/3 to 18/);
    expect(plan({ ...same(), con: 2 })).toMatch(/3 to 18/);
    expect(plan({ ...same(), dex: 12.5 })).toMatch(/whole number/);
  });
  it("keeps thieves neutral or chaotic (WW p. 9)", () => {
    expect(plan({ ...same(), alignment: "lawful" })).toMatch(/WW p. 9/);
    expect(planOverride(cur, { ...same(), alignment: "lawful" }, "fighting-man")).not.toBeTypeOf("string");
  });
  it("won't drop XP below a level whose hit die is already rolled", () => {
    // Thief level 2 starts at 1,250 XP (WW p. 9).
    expect(plan({ ...same(), xp: { k1: 1249 } })).toMatch(/level 2/);
    expect(plan({ ...same(), xp: { k1: 1250 } })).not.toBeTypeOf("string");
  });
  it("needs a name, maximum hit points of 1 or more, and XP for every class", () => {
    expect(plan({ ...same(), name: "  " })).toMatch(/name/);
    expect(plan({ ...same(), hpMax: 0 })).toMatch(/Maximum hit points/);
    expect(plan({ ...same(), xp: {} })).toMatch(/Enter XP/);
    expect(plan({ ...same(), xp: { k1: 1300, other: 5 } })).toBe("Unknown class");
  });
  it("an empty patron clears it", () => {
    const p = planOverride({ ...cur, deity: "Ashan" }, same(), "thief") as OverridePlan;
    expect(p.set).toEqual({ deity: null });
  });
});

describe("hand-set markers", () => {
  it("merge without repeats, in a fixed order", () => {
    expect(mergeManual(["hpMax"], ["con", "str"])).toEqual(["str", "con", "hpMax"]);
    expect(mergeManual(["str"], ["str"])).toEqual(["str"]);
  });
});
