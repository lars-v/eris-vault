import "server-only";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import type { CurrentUser } from "@/lib/session";

export async function writeAudit(
  actor: CurrentUser,
  entry: {
    action: string;
    characterId?: string;
    targetUserId?: string;
    before?: unknown;
    after?: unknown;
  },
) {
  await db.insert(auditLog).values({
    actorId: actor.userId,
    actorRole: actor.role,
    action: entry.action,
    characterId: entry.characterId,
    targetUserId: entry.targetUserId,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}
