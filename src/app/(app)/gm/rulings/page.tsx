import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { Nav } from "@/components/Nav";
import { PageHeader, Panel } from "@/components/ui";
import { db } from "@/db";
import { rulings, users } from "@/db/schema";
import { RULING_EXAMPLES } from "@/lib/ruling-examples";
import { requireStaff } from "@/lib/session";
import { RulingCard, type RulingView } from "./RulingCard";

export const metadata = { title: "Rulings" };

export default async function RulingsPage() {
  const viewer = await requireStaff();
  const rows = await db
    .select({
      key: rulings.key,
      question: rulings.question,
      sources: rulings.sources,
      answer: rulings.answer,
      status: rulings.status,
      decidedByName: users.name,
      decidedAt: rulings.decidedAt,
    })
    .from(rulings)
    .leftJoin(users, eq(users.id, rulings.decidedBy))
    .orderBy(sql`${rulings.decidedAt} desc nulls last`, asc(rulings.key));

  const view = (r: (typeof rows)[number]): RulingView => ({
    ...r,
    decidedAt: r.decidedAt ? r.decidedAt.toISOString().slice(0, 10) : null,
  });
  const open = rows.filter((r) => r.status === "pending").map(view);
  // Answered here first, newest at the top; the ones seeded as decided after.
  const onFile = rows.filter((r) => r.status === "decided").map(view);

  return (
    <>
      <Nav viewer={viewer} active="gm" />
      <main className="mx-auto flex max-w-220 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader eyebrow="GM tools" title="Rulings" tone="amber">
          <Link href="/gm" className="text-sm text-muted hover:text-lime">
            Back to GM tools
          </Link>
        </PageHeader>

        <p className="text-sm leading-relaxed text-muted">
          These are the questions the books leave open. Pick an example answer to start from, change it if you like, or write your own. Your answer
          goes on file at once and in the audit log. The vault keeps doing what it does now until Lars changes it to follow your answer.
        </p>

        <Panel title={`Waiting for a ruling · ${open.length}`}>
          {open.length === 0 ? (
            <p className="text-sm text-muted">Every question has an answer.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {open.map((r) => (
                <RulingCard key={r.key} ruling={r} examples={RULING_EXAMPLES[r.key] ?? []} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={`On file · ${onFile.length}`}>
          <ul className="flex flex-col gap-3">
            {onFile.map((r) => (
              <RulingCard key={r.key} ruling={r} examples={RULING_EXAMPLES[r.key] ?? []} />
            ))}
          </ul>
        </Panel>
      </main>
    </>
  );
}
