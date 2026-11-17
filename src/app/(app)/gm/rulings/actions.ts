"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { rulings } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { cleanRulingAnswer } from "@/lib/ruling-examples";
import { can } from "@/lib/roles";
import { requireUser } from "@/lib/session";

/**
 * Jay (or an admin) answers an open ruling, or changes an answer on file.
 * The answer goes in the rulings table with who and when, and the change is
 * audited. The vault's behavior only follows once the code is changed to match.
 */

export type RulingResult = { error: string | null; at: number; key: string | null };

const KEY = /^[a-z0-9-]{1,64}$/;

export async function decideRuling(_prev: RulingResult, formData: FormData): Promise<RulingResult> {
  const key = String(formData.get("key") ?? "");
  try {
    const viewer = await requireUser();
    if (!can.editRulings(viewer)) throw new Error("Only Jay or an admin can record a ruling.");
    if (!KEY.test(key)) throw new Error("Unknown ruling");
    const answer = cleanRulingAnswer(String(formData.get("answer") ?? ""));
    const before = await db.transaction(async (tx) => {
      const [r] = await tx.select().from(rulings).where(eq(rulings.key, key)).for("update");
      if (!r) throw new Error("Unknown ruling");
      if (r.status === "decided" && r.answer === answer) return null;
      await tx
        .update(rulings)
        .set({ answer, status: "decided", decidedBy: viewer.userId, decidedAt: new Date() })
        .where(eq(rulings.key, key));
      return { status: r.status, answer: r.answer };
    });
    if (before) {
      await writeAudit(viewer, {
        action: before.status === "decided" ? "ruling.changed" : "ruling.decided",
        before: { key, ...before },
        after: { key, status: "decided", answer },
      });
    }
    revalidatePath("/gm/rulings");
    revalidatePath("/gm");
    return { error: null, at: Date.now(), key };
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e instanceof Error ? e.message : "Something went wrong.").slice(0, 200), at: Date.now(), key };
  }
}
