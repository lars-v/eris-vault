import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Chip, PageHeader } from "@/components/ui";
import { listCharacters } from "@/lib/queries";
import { CLASS_NAMES, levelFor } from "@/lib/rules/advancement";
import { requireUser } from "@/lib/session";

export const metadata = { title: "The party" };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function PartyPage() {
  const viewer = await requireUser();
  const party = await listCharacters();

  return (
    <>
      <Nav viewer={viewer} active="party" />
      <main className="mx-auto flex max-w-[1280px] flex-col gap-7 px-4 py-10 sm:px-8">
        <PageHeader eyebrow="Rath Denacht · last year of Hibernumn" title="The party">
          <span
            className="inline-flex min-h-11 items-center rounded-xl border border-dashed border-line-2 px-4 text-sm text-subtle"
            title="The creation wizard arrives in the next build"
          >
            New character: next build
          </span>
        </PageHeader>

        {party.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-2 p-8 text-muted">
            No characters yet. {viewer.role === "admin" ? "Import Liz from the admin page to see a full sheet." : "They'll appear here as players make them."}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
            {party.map((c) => {
              const lvl = c.cls ? levelFor(c.cls, c.xp ?? 0) : null;
              const pct = c.hpMax > 0 ? Math.max(0, Math.min(100, Math.round((c.hpCurrent / c.hpMax) * 100))) : 0;
              return (
                <Link
                  key={c.id}
                  href={`/characters/${c.id}`}
                  className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 hover:border-line-2"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-16 flex-none items-center justify-center rounded-[50%] border-[1.5px] border-lime font-display text-2xl text-lime">
                      {c.name
                        .split(" ")
                        .filter((w) => /^[A-Z]/.test(w))
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="font-display text-[28px] leading-none">{c.name}</div>
                      <div className="text-sm text-muted">
                        {cap(c.race)} {c.cls ? CLASS_NAMES[c.cls] : ""} · {cap(c.alignment)}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {lvl && (
                          <Chip tone="lime">
                            Level {lvl.level}
                            {lvl.pastNine ? "+" : ""} · {lvl.title}
                          </Chip>
                        )}
                        {c.deity && <Chip>{c.deity}</Chip>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-muted">Hit points</span>
                      <span className="font-mono">
                        {c.hpCurrent} / {c.hpMax}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#262920]">
                      <div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#262920] pt-3 text-[13px]">
                    <span className="text-muted">Player: {c.ownerName ?? "unknown"}</span>
                    {c.status === "submitted" ? (
                      <Chip tone="amber">
                        {c.importFlagCount > 0 ? `Imported · ${c.importFlagCount} flags` : "Awaiting Jay"}
                      </Chip>
                    ) : (
                      <Chip>{cap(c.status)}</Chip>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
