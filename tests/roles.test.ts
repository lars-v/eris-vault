import { describe, expect, it } from "vitest";
import { can, canChangeAccount, effectiveRole, parseAdminIds, type Viewer } from "@/lib/roles";
import { claimExpiry, hashClaimCode, hashesMatch, isClaimUsable, newClaimCode } from "@/lib/claim";

const player: Viewer = { userId: "p1", role: "player", status: "active", railwayAdmin: false };
const other: Viewer = { userId: "p2", role: "player", status: "active", railwayAdmin: false };
const gm: Viewer = { userId: "jay", role: "gm", status: "active", railwayAdmin: false };
const admin: Viewer = { userId: "lars", role: "admin", status: "active", railwayAdmin: true };
const blocked: Viewer = { userId: "x", role: "player", status: "blocked", railwayAdmin: false };

const own = { ownerId: "p1", status: "approved" as const };
const ownDraft = { ownerId: "p1", status: "draft" as const };
const ownSubmitted = { ownerId: "p1", status: "submitted" as const };

describe("ADMIN_GITHUB_IDS", () => {
  it("keeps only numeric ids", () => {
    expect([...parseAdminIds("50210434, abc, 12")]).toEqual(["50210434", "12"]);
    expect(parseAdminIds(undefined).size).toBe(0);
  });
  it("a Railway-listed admin is admin whatever the stored role", () => {
    expect(effectiveRole("player", true)).toBe("admin");
    expect(effectiveRole("gm", false)).toBe("gm");
  });
});

describe("who can do what (plan: Who can do what)", () => {
  it("everyone active can read every sheet; blocked accounts can't", () => {
    expect(can.viewSheet(other)).toBe(true);
    expect(can.viewSheet(blocked)).toBe(false);
  });
  it("owners edit play state; others can't", () => {
    expect(can.editPlayState(player, own)).toBe(true);
    expect(can.editPlayState(other, own)).toBe(false);
    expect(can.editPlayState(gm, own)).toBe(true);
    expect(can.editPlayState(admin, own)).toBe(true);
  });
  it("players delete their own characters until Jay approves; GM and admin delete any", () => {
    expect(can.deleteCharacter(player, ownDraft)).toBe(true);
    expect(can.deleteCharacter(player, ownSubmitted)).toBe(true);
    expect(can.deleteCharacter(player, own)).toBe(false);
    expect(can.deleteCharacter(other, ownSubmitted)).toBe(false);
    expect(can.deleteCharacter(gm, own)).toBe(true);
    expect(can.deleteCharacter(admin, own)).toBe(true);
  });
  it("core stats lock once a character leaves draft, except for GM and admin", () => {
    expect(can.editCoreStats(player, ownDraft)).toBe(true);
    expect(can.editCoreStats(player, own)).toBe(false);
    expect(can.editCoreStats(gm, own)).toBe(true);
    expect(can.editCoreStats(admin, own)).toBe(true);
  });
  it("XP, approvals, rulings and blocking are GM or admin only", () => {
    for (const fn of [can.awardXp, can.approve, can.editRulings, can.blockAccounts, can.readAuditLog]) {
      expect(fn(player)).toBe(false);
      expect(fn(gm)).toBe(true);
      expect(fn(admin)).toBe(true);
    }
  });
  it("roles and settings are admin only", () => {
    for (const fn of [can.manageGms, can.manageAdmins, can.settings]) {
      expect(fn(gm)).toBe(false);
      expect(fn(admin)).toBe(true);
    }
  });
  it("nobody can change the Railway-listed admin from inside the app", () => {
    expect(canChangeAccount(admin, { userId: "lars", railwayAdmin: true })).toBe(false);
    expect(canChangeAccount(admin, { userId: "jay", railwayAdmin: false })).toBe(true);
    expect(canChangeAccount(gm, { userId: "p1", railwayAdmin: false })).toBe(false);
  });
});

describe("GM claim codes", () => {
  it("only the hash is compared, and it matches its own code", () => {
    const code = newClaimCode();
    expect(code.length).toBeGreaterThanOrEqual(32);
    expect(hashesMatch(hashClaimCode(code), hashClaimCode(code))).toBe(true);
    expect(hashesMatch(hashClaimCode(code), hashClaimCode(code + "x"))).toBe(false);
  });
  it("expires after 48 hours and works once", () => {
    const now = new Date("2026-11-01T12:00:00Z");
    const exp = claimExpiry(now);
    expect(exp.toISOString()).toBe("2026-11-03T12:00:00.000Z");
    expect(isClaimUsable({ expiresAt: exp, usedAt: null }, now)).toBe(true);
    expect(isClaimUsable({ expiresAt: exp, usedAt: now }, now)).toBe(false);
    expect(isClaimUsable({ expiresAt: exp, usedAt: null }, new Date("2026-11-03T12:00:01Z"))).toBe(false);
  });
});
