import { describe, expect, it } from "vitest";
import type { CharacterClass } from "@/db/schema";
import { can, type Viewer } from "@/lib/roles";
import {
  checkLoad,
  checkRelease,
  checkVoid,
  isStaffSpell,
  lostWithItem,
  slotStates,
  STAFF_NOTE_MAX,
  staffBadge,
  staffCapacity,
  staffSpells,
  staffWarnings,
  type StaffEvent,
} from "@/lib/rules/staff";

const at = (n: number) => new Date(Date.UTC(2026, 10, 16, 12, 0, n));
const ev = (slot: number, action: StaffEvent["action"], spell: string, n: number, inventoryId = "staff-1"): StaffEvent => ({
  slot,
  action,
  spell,
  inventoryId,
  createdAt: at(n),
});

describe("staff capacity (Woundwort's Warren pp. 5, 7)", () => {
  const cases: { who: string; classes: CharacterClass[] }[] = [
    { who: "magic-user", classes: ["magic-user"] },
    // An elf with magic-user as one of two classes follows the same rule (Jay's ruling elf-wand-int).
    { who: "elf magic-user", classes: ["fighting-man", "magic-user"] },
  ];
  for (const c of cases) {
    it(`${c.who}: Int 3, 14 none; 15, 17 one; 18 two`, () => {
      expect([3, 14, 15, 17, 18].map((int) => staffCapacity(c.classes, int))).toEqual([0, 0, 1, 1, 2]);
    });
  }

  it("clerics and thieves never store spells, whatever their Intelligence", () => {
    for (const cls of ["cleric", "thief"] as const) {
      expect([3, 14, 15, 17, 18].map((int) => staffCapacity([cls], int))).toEqual([0, 0, 0, 0, 0]);
    }
  });

  it("an elf who is only a fighting-man stores nothing", () => {
    expect(staffCapacity(["fighting-man"], 18)).toBe(0);
  });

  it("unknown Intelligence stores nothing", () => {
    expect(staffCapacity(["magic-user"], null)).toBe(0);
  });
});

describe("what a staff can hold (WW p. 26)", () => {
  it("the ten 1st-level magic-user spells, and nothing else", () => {
    expect(staffSpells().map((s) => s.name)).toEqual([
      "Charm Person",
      "Detect Magic",
      "Floating Disc",
      "Hold Portal",
      "Light",
      "Magic Missile",
      "Protection from Chaos",
      "Read Languages",
      "Read Magic",
      "Sleep",
    ]);
    expect(isStaffSpell("mu:sleep")).toBe(true);
    // Web and Wizard Lock are 2nd-level on WW p. 26.
    expect(isStaffSpell("mu:web")).toBe(false);
    expect(isStaffSpell("mu:wizard-lock")).toBe(false);
    expect(isStaffSpell("cl:light")).toBe(false);
    expect(isStaffSpell("nonsense")).toBe(false);
  });
});

describe("slot state is the latest event", () => {
  it("empty with no events", () => {
    expect(slotStates([]).map((s) => s.spell)).toEqual([null, null]);
  });

  it("load fills, release and void empty, in any order given", () => {
    const events = [ev(1, "release", "mu:sleep", 2), ev(1, "load", "mu:sleep", 1), ev(1, "load", "mu:light", 3), ev(2, "load", "mu:magic-missile", 1), ev(2, "void", "mu:magic-missile", 4)];
    const [one, two] = slotStates(events);
    expect(one).toMatchObject({ slot: 1, spell: "mu:light", inventoryId: "staff-1" });
    expect(two).toMatchObject({ slot: 2, spell: null, inventoryId: null });
    expect(two.last?.action).toBe("void");
  });
});

describe("load and release refuse invalid states", () => {
  const empty = slotStates([]);
  const sleepIn1 = slotStates([ev(1, "load", "mu:sleep", 1)]);
  const base = { states: empty, capacity: 1, slot: 1, spell: "mu:sleep", hasFocus: true };

  it("loads an empty slot within capacity", () => {
    expect(checkLoad(base)).toBeNull();
    expect(checkLoad({ ...base, capacity: 2, slot: 2 })).toBeNull();
  });

  it("refuses a full slot", () => {
    expect(checkLoad({ ...base, states: sleepIn1 })).toMatch(/already holds Sleep/);
  });

  it("refuses a slot past capacity", () => {
    expect(checkLoad({ ...base, slot: 2 })).toMatch(/slot 2 can't be used/);
    expect(checkLoad({ ...base, capacity: 0 })).toMatch(/Intelligence bonus/);
  });

  it("refuses slots that don't exist", () => {
    expect(checkLoad({ ...base, capacity: 2, slot: 3 })).toMatch(/doesn't exist/);
    expect(checkLoad({ ...base, slot: NaN })).toMatch(/doesn't exist/);
  });

  it("refuses spells a staff can't hold", () => {
    expect(checkLoad({ ...base, spell: "mu:web" })).toMatch(/1st-level magic-user spells only/);
    expect(checkLoad({ ...base, spell: "cl:cure-light-wounds" })).toMatch(/1st-level magic-user spells only/);
    expect(checkLoad({ ...base, spell: "" })).toMatch(/1st-level magic-user spells only/);
  });

  it("refuses without a staff or wand set", () => {
    expect(checkLoad({ ...base, hasFocus: false })).toMatch(/spell focus/);
  });

  it("releases only a loaded slot", () => {
    expect(checkRelease(sleepIn1, 1)).toBeNull();
    expect(checkRelease(sleepIn1, 2)).toMatch(/already empty/);
    expect(checkRelease(empty, 1)).toMatch(/already empty/);
    expect(checkRelease(empty, 0)).toMatch(/doesn't exist/);
  });

  it("void needs a loaded slot and a short note", () => {
    expect(checkVoid(sleepIn1, 1, "The staff broke.")).toBeNull();
    expect(checkVoid(sleepIn1, 1, "  ")).toMatch(/Say why/);
    expect(checkVoid(sleepIn1, 1, "x".repeat(STAFF_NOTE_MAX + 1))).toMatch(/Keep the note/);
    expect(checkVoid(empty, 1, "The staff broke.")).toMatch(/already empty/);
  });
});

describe("warnings never clear anything", () => {
  const items = new Set(["staff-1", "wand-2"]);

  it("none for a normal staff", () => {
    expect(staffWarnings({ states: slotStates([ev(1, "load", "mu:sleep", 1)]), capacity: 1, focusId: "staff-1", itemIds: items })).toEqual([]);
  });

  it("capacity below the loaded slots (Int lowered)", () => {
    const states = slotStates([ev(1, "load", "mu:sleep", 1), ev(2, "load", "mu:light", 2)]);
    expect(staffWarnings({ states, capacity: 1, focusId: "staff-1", itemIds: items }).map((w) => w.ruling)).toEqual(["staff-int-drop"]);
    expect(staffWarnings({ states, capacity: 0, focusId: "staff-1", itemIds: items })[0].text).toMatch(/can't store spells now/);
  });

  it("the staff has left the gear, or is no longer the focus", () => {
    const states = slotStates([ev(1, "load", "mu:sleep", 1, "gone")]);
    expect(staffWarnings({ states, capacity: 1, focusId: "staff-1", itemIds: items })).toEqual([
      { ruling: "staff-loss", text: "The staff or wand holding Sleep is no longer in this character's gear, so the spell is lost. Jay voids the slot." },
    ]);
    const moved = slotStates([ev(1, "load", "mu:sleep", 1, "staff-1")]);
    expect(staffWarnings({ states: moved, capacity: 1, focusId: "wand-2", itemIds: items }).map((w) => w.ruling)).toEqual([null]);
  });

  it("the same spell in both slots is fine (Jay's ruling staff-same-spell-twice)", () => {
    const states = slotStates([ev(1, "load", "mu:sleep", 1), ev(2, "load", "mu:sleep", 2)]);
    expect(staffWarnings({ states, capacity: 2, focusId: "staff-1", itemIds: items })).toEqual([]);
  });
});

describe("spells lost with the staff (Jay's ruling staff-loss)", () => {
  it("finds the slots stored in the item that left", () => {
    const states = slotStates([ev(1, "load", "mu:sleep", 1, "staff-1"), ev(2, "load", "mu:light", 2, "wand-2")]);
    expect(lostWithItem(states, "staff-1").map((s) => s.slot)).toEqual([1]);
    expect(lostWithItem(states, "other")).toEqual([]);
    const released = slotStates([ev(1, "load", "mu:sleep", 1, "staff-1"), ev(1, "release", "mu:sleep", 2, "staff-1")]);
    expect(lostWithItem(released, "staff-1")).toEqual([]);
  });
});

describe("party page badge", () => {
  it("names what is ready, or says empty", () => {
    expect(staffBadge(slotStates([ev(1, "load", "mu:sleep", 1)]), true)).toBe("Staff: Sleep ready");
    expect(staffBadge(slotStates([ev(1, "load", "mu:sleep", 1), ev(2, "load", "mu:light", 1)]), true)).toBe("Staff: Sleep, Light ready");
    expect(staffBadge(slotStates([]), true)).toBe("Staff: empty");
    expect(staffBadge(slotStates([]), false)).toBeNull();
  });
});

describe("who can use the staff", () => {
  const player: Viewer = { userId: "p1", role: "player", status: "active", railwayAdmin: false };
  const other: Viewer = { userId: "p2", role: "player", status: "active", railwayAdmin: false };
  const gm: Viewer = { userId: "jay", role: "gm", status: "active", railwayAdmin: false };
  const admin: Viewer = { userId: "lars", role: "admin", status: "active", railwayAdmin: true };
  const blocked: Viewer = { userId: "p1", role: "player", status: "blocked", railwayAdmin: false };
  const own = { ownerId: "p1", status: "approved" as const };

  it("owner, Jay and admins load and release; other players and blocked accounts can't", () => {
    expect(can.useSpellStaff(player, own)).toBe(true);
    expect(can.useSpellStaff(gm, own)).toBe(true);
    expect(can.useSpellStaff(admin, own)).toBe(true);
    expect(can.useSpellStaff(other, own)).toBe(false);
    expect(can.useSpellStaff(blocked, own)).toBe(false);
  });

  it("only Jay and admins void", () => {
    expect(can.voidStoredSpell(player)).toBe(false);
    expect(can.voidStoredSpell(gm)).toBe(true);
    expect(can.voidStoredSpell(admin)).toBe(true);
  });
});
