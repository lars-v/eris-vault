import "server-only";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { accounts, profiles, users } from "@/db/schema";
import { can, effectiveRole, parseAdminIds, type Viewer } from "@/lib/roles";

export type CurrentUser = Viewer & {
  name: string | null;
  image: string | null;
  githubLogin: string | null;
};

/** True when this user has a linked GitHub account whose ID is listed in ADMIN_GITHUB_IDS. */
export async function isRailwayAdmin(userId: string): Promise<boolean> {
  const ids = [...parseAdminIds(process.env.ADMIN_GITHUB_IDS)];
  if (ids.length === 0) return false;
  const rows = await db
    .select({ id: accounts.providerAccountId })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.provider, "github"),
        inArray(accounts.providerAccountId, ids),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Data access layer: the one place pages and actions learn who is asking. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const [row] = await db
    .select({
      name: users.name,
      image: users.image,
      role: profiles.role,
      status: profiles.status,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return null;

  if (!row.role) {
    await db.insert(profiles).values({ userId }).onConflictDoNothing();
  }

  const railwayAdmin = await isRailwayAdmin(userId);
  return {
    userId,
    name: row.name,
    image: row.image,
    githubLogin: null,
    role: effectiveRole(row.role ?? "player", railwayAdmin),
    status: row.status ?? "active",
    railwayAdmin,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/");
  if (!can.useApp(viewer)) redirect("/blocked");
  return viewer;
}

export async function requireStaff(): Promise<CurrentUser> {
  const viewer = await requireUser();
  if (!can.openGmTools(viewer)) redirect("/party");
  return viewer;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const viewer = await requireUser();
  if (!can.settings(viewer)) redirect("/party");
  return viewer;
}
