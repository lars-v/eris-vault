import Link from "next/link";
import { DiceFaces, PURPOSE_LABEL } from "@/components/Dice";
import { Nav } from "@/components/Nav";
import { PageHeader, Panel } from "@/components/ui";
import { listRolls } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Roll log" };

export default async function RollsPage() {
  const viewer = await requireUser();
  const rolls = await listRolls({ limit: 300 });
  return (
    <>
      <Nav viewer={viewer} active="rolls" />
      <main className="mx-auto flex max-w-[1080px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader eyebrow="Every die, for the whole table" title="Roll log" />
        <p className="max-w-[720px] text-[15px] leading-relaxed text-muted">
          The server rolls, and rolls can only be added here, never changed or removed. Rolls for deleted drafts stay too.
        </p>
        <Panel title={`Latest ${rolls.length}`}>
          {rolls.length === 0 ? (
            <p className="text-sm text-muted">No rolls yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[#262920]">
              {rolls.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-[15px]">
                      <span className="font-semibold">{r.rollerName ?? "Someone"}</span> · {PURPOSE_LABEL[r.purpose] ?? r.purpose}
                      {r.characterId && (
                        <>
                          {" for "}
                          {r.characterDeleted ? (
                            <span className="text-subtle">{r.characterName} (deleted draft)</span>
                          ) : (
                            <Link href={`/characters/${r.characterId}`} className="text-lime underline-offset-4 hover:underline">
                              {r.characterName}
                            </Link>
                          )}
                        </>
                      )}
                    </span>
                    <span className="font-mono text-xs text-subtle">{r.formula}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-3">
                    {r.dice.map((set, i) => (
                      <span key={i} className="flex items-center gap-1.5">
                        <DiceFaces faces={set} size="sm" />
                        <span className="font-mono text-sm">= {r.totals[i]}</span>
                      </span>
                    ))}
                    <time className="text-xs text-subtle" dateTime={r.createdAt.toISOString()}>
                      {r.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC
                    </time>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </main>
    </>
  );
}
