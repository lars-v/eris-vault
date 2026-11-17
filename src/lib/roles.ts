import type { AccountStatus, CharacterStatus, Role } from "@/db/schema";

/**
 * Who can do what. Pure functions so the table on the plan canvas
 * ("Who can do what") is enforced in one place and covered by tests.
 */
export type Viewer = {
  userId: string;
  role: Role;
  status: AccountStatus;
  railwayAdmin: boolean;
};

export type CharacterRef = { ownerId: string; status: CharacterStatus };

/** ADMIN_GITHUB_IDS is a comma-separated list of numeric GitHub account IDs. */
export function parseAdminIds(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s)),
  );
}

export function effectiveRole(storedRole: Role, railwayAdmin: boolean): Role {
  return railwayAdmin ? "admin" : storedRole;
}

const isStaff = (v: Viewer) => v.role === "gm" || v.role === "admin";

export const can = {
  useApp: (v: Viewer) => v.status === "active",
  viewSheet: (v: Viewer) => v.status === "active",
  createCharacter: (v: Viewer) => v.status === "active",
  editPlayState: (v: Viewer, c: CharacterRef) =>
    v.status === "active" && (isStaff(v) || c.ownerId === v.userId),
  // Gear changes in play: the player who owns the character, or Jay and admins on any character.
  editGear: (v: Viewer, c: CharacterRef) =>
    v.status === "active" && (isStaff(v) || c.ownerId === v.userId),
  // The day's prepared spells: the player who owns the character, or Jay and admins.
  editSpells: (v: Viewer, c: CharacterRef) =>
    v.status === "active" && (isStaff(v) || c.ownerId === v.userId),
  // Loading and releasing spells in the staff or wand (WW p. 7): the player who owns
  // the character, or Jay and admins. The status check is playStateOpen.
  useSpellStaff: (v: Viewer, c: CharacterRef) =>
    v.status === "active" && (isStaff(v) || c.ownerId === v.userId),
  // Clearing a stored spell by ruling (for example a broken staff): Jay and admins only.
  voidStoredSpell: (v: Viewer) => v.status === "active" && isStaff(v),
  // The character's picture: the player who owns it, or Jay and admins, at any status.
  editPortrait: (v: Viewer, c: CharacterRef) =>
    v.status === "active" && (isStaff(v) || c.ownerId === v.userId),
  // Magic gear counts 0 units (campaign ruling), so only Jay and admins mark or unmark it.
  markMagic: (v: Viewer) => v.status === "active" && isStaff(v),
  // The build wizard: the player who owns the character until Jay approves it, or Jay and
  // admins on any character. The wizard itself locks abilities, race and class once hit
  // points are rolled.
  editCoreStats: (v: Viewer, c: CharacterRef) =>
    v.status === "active" &&
    (isStaff(v) || (c.ownerId === v.userId && (c.status === "draft" || c.status === "submitted"))),
  awardXp: (v: Viewer) => v.status === "active" && isStaff(v),
  // Setting abilities, maximum hit points, XP and identity by hand, with a reason. Audited.
  overrideStats: (v: Viewer) => v.status === "active" && isStaff(v),
  approve: (v: Viewer) => v.status === "active" && isStaff(v),
  editRulings: (v: Viewer) => v.status === "active" && isStaff(v),
  blockAccounts: (v: Viewer) => v.status === "active" && isStaff(v),
  readAuditLog: (v: Viewer) => v.status === "active" && isStaff(v),
  // Players may withdraw a character until Jay approves it.
  deleteCharacter: (v: Viewer, c: CharacterRef) =>
    v.status === "active" &&
    (isStaff(v) || (c.ownerId === v.userId && (c.status === "draft" || c.status === "submitted"))),
  manageGms: (v: Viewer) => v.status === "active" && v.role === "admin",
  manageAdmins: (v: Viewer) => v.status === "active" && v.role === "admin",
  settings: (v: Viewer) => v.status === "active" && v.role === "admin",
  openGmTools: (v: Viewer) => v.status === "active" && isStaff(v),
};

/** Nobody can block or demote an admin who is listed on Railway. */
export function canChangeAccount(actor: Viewer, target: { railwayAdmin: boolean; userId: string }) {
  if (target.railwayAdmin) return false;
  if (target.userId === actor.userId) return false;
  return actor.status === "active" && actor.role === "admin";
}
