import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Chip, PageHeader, Panel } from "@/components/ui";
import { listAudit, listRulings, reviewQueue } from "@/lib/queries";
import { requireStaff } from "@/lib/session";

export const metadata = { title: "GM tools" };

export default async function GmPage() {
  const viewer = await requireStaff();
  const [queue, rulings, audit] = await Promise.all([reviewQueue(), listRulings(), listAudit(30)]);
  const pending = rulings.filter((r) => r.status === "pending");
  const decided = rulings.filter((r) => r.status === "decided");

  return (
    <>
      <Nav viewer={viewer} active="gm" />
      <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader eyebrow={viewer.role === "admin" ? "GM tools · as admin" : "Game master"} title="GM tools" tone="amber" />

        <div className="flex flex-wrap items-start gap-5">
          <Panel title={`Review queue · ${queue.length}`} className="min-w-0 flex-[999_1_560px]">
            {queue.length === 0 ? (
              <p className="text-sm text-muted">Nothing waiting for review.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[#262920]">
                {queue.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="flex flex-col">
                      <Link href={`/characters/${c.id}`} className="font-display text-2xl hover:text-lime">
                        {c.name}
                      </Link>
                      <span className="text-sm text-muted">Player: {c.ownerName ?? "unknown"}</span>
                    </span>
                    {c.flags.length > 0 ? <Chip tone="amber">{c.flags.length} flags</Chip> : <Chip>Submitted</Chip>}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-subtle">Open a character to approve it, return it to the player, or grant a re-roll. Award XP from the character&apos;s sheet.</p>
          </Panel>

          <Panel title="Rulings ledger" className="min-w-0 flex-[1_1_360px]">
            <div className="text-xs font-semibold text-lime">On file · {decided.length}</div>
            {decided.map((r) => (
              <div key={r.key} className="flex flex-col gap-0.5 rounded-lg bg-surface-2 px-3 py-2.5">
                <span className="text-sm">{r.answer}</span>
                <span className="text-xs text-subtle">{r.sources}</span>
              </div>
            ))}
            <div className="mt-1 text-xs font-semibold text-amber">Waiting for a ruling · {pending.length}</div>
            <ul className="flex flex-col divide-y divide-[#262920]">
              {pending.map((r) => (
                <li key={r.key} className="flex flex-col gap-0.5 py-2">
                  <span className="text-sm text-[#d6d2c2]">{r.question}</span>
                  <span className="text-xs text-subtle">{r.sources}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel title="Audit log" aside="Includes every admin action">
          {audit.length === 0 ? (
            <p className="text-sm text-muted">Nothing logged yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[#262920]">
              {audit.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-3 py-2.5 text-sm">
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className={a.actorRole === "admin" ? "font-semibold text-moon" : a.actorRole === "gm" ? "font-semibold text-amber" : "font-semibold"}>
                      {a.actorName ?? "System"}
                    </span>
                    <span className="font-mono text-xs text-muted">{a.action}</span>
                    {a.after != null && <span className="font-mono text-xs break-all text-subtle">{JSON.stringify(a.after)}</span>}
                  </span>
                  <time className="text-xs text-subtle" dateTime={a.createdAt.toISOString()}>
                    {a.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </main>
    </>
  );
}
