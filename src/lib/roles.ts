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
  editCoreStats: (v: Viewer, c: CharacterRef) =>
    v.status === "active" && (isStaff(v) || (c.ownerId === v.userId && c.status === "draft")),
  awardXp: (v: Viewer) => v.status === "active" && isStaff(v),
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
