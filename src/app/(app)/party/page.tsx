import Link from "next/link";
import { enabledProviders } from "@/auth";
import { Guide } from "@/components/Guide";
import { Nav } from "@/components/Nav";
import { Portrait } from "@/components/Portrait";
import { Chip, PageHeader } from "@/components/ui";
import { levelUpsWaiting, listCharacters } from "@/lib/queries";
import { welcomeSteps } from "@/lib/guide";
import { can } from "@/lib/roles";
import { cappedLevelFor, CLASS_NAMES } from "@/lib/rules/advancement";
import { armorClass } from "@/lib/rules/armor";
import { PARTY_SORTS, parsePartySort, sortParty, type PartySort } from "@/lib/party-sort";
import { requireUser } from "@/lib/session";
import { DeleteCharacterButton } from "./DeleteCharacterButton";

export const metadata = { title: "The party" };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function PartyPage({ searchParams }: { searchParams: Promise<{ error?: string; guide?: string; view?: string; sort?: string }> }) {
  const viewer = await requireUser();
  const { error, guide, view, sort: sortParam } = await searchParams;
  const [everyone, waiting] = await Promise.all([listCharacters(), levelUpsWaiting()]);
  const levelUp = new Set(waiting.map((w) => w.characterId));
  const mineOnly = view === "mine";
  const mine = everyone.filter((c) => c.ownerId === viewer.userId);
  const sort = parsePartySort(sortParam);
  const party = sortParty(
    (mineOnly ? mine : everyone).map((c) => {
      const lvl = c.cls ? cappedLevelFor(c.race, c.cls, c.xp ?? 0) : null;
      return { ...c, lvl, level: lvl?.level ?? null, className: c.cls ? CLASS_NAMES[c.cls] : null };
    }),
    sort,
  );
  // Keep the other choice when one changes; defaults stay out of the URL.
  const partyHref = (v: "all" | "mine", s: PartySort) => {
    const q = new URLSearchParams();
    if (v === "mine") q.set("view", "mine");
    if (s !== "player") q.set("sort", s);
    const qs = q.toString();
    return qs ? `/party?${qs}` : "/party";
  };
  const viewTab = (active: boolean) =>
    `inline-flex min-h-11 items-center rounded-lg px-4 text-sm ${
      active ? "bg-[#262920] font-semibold text-lime" : "text-muted hover:text-[#d6d2c2]"
    }`;

  return (
    <>
      <Nav viewer={viewer} active="party" />
      <Guide
        guide="welcome"
        steps={welcomeSteps({ name: viewer.name, role: viewer.role, canLinkSignIns: enabledProviders.length > 1 })}
        autoStart={!viewer.guidesSeen.includes("welcome")}
        forceOpen={guide === "1"}
      />
      <main className="mx-auto flex max-w-[1280px] flex-col gap-7 px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader eyebrow="Rath Denacht · last year of Hibernumn" title="The party">
          <span className="flex flex-wrap gap-2">
            <Link
              href="/characters/import"
              className="inline-flex min-h-11 items-center rounded-xl border border-line-2 px-4 text-sm text-[#d6d2c2] hover:border-lime"
            >
              Upload a sheet
            </Link>
            <Link
              href="/characters/new"
              data-guide="new-character"
              className="inline-flex min-h-11 items-center rounded-xl bg-lime px-4 text-sm font-semibold text-lime-ink hover:brightness-110"
            >
              New character
            </Link>
          </span>
        </PageHeader>

        {error && (
          <div role="alert" className="rounded-xl border border-[#5c3328] bg-[#2e1a15] px-4 py-3 text-sm text-ember">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <nav aria-label="Whose characters" className="flex w-fit gap-1 rounded-xl border border-line p-1">
            <Link href={partyHref("all", sort)} className={viewTab(!mineOnly)} aria-current={!mineOnly ? "page" : undefined}>
              Everyone ({everyone.length})
            </Link>
            <Link href={partyHref("mine", sort)} className={viewTab(mineOnly)} aria-current={mineOnly ? "page" : undefined}>
              Mine ({mine.length})
            </Link>
          </nav>
          <nav aria-label="Sort by" className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-sm text-muted">Sort by</span>
            {PARTY_SORTS.map((s) => (
              <Link
                key={s.key}
                href={partyHref(mineOnly ? "mine" : "all", s.key)}
                className={viewTab(sort === s.key)}
                aria-current={sort === s.key ? "page" : undefined}
              >
                {s.label}
              </Link>
            ))}
          </nav>
        </div>

        {party.length === 0 ? (
          <div data-guide="party" className="rounded-2xl border border-dashed border-line-2 p-8 text-muted">
            {mineOnly ? (
              <>
                You have no characters yet.{" "}
                <Link href="/characters/new" className="text-lime underline-offset-4 hover:underline">
                  Make one
                </Link>{" "}
                or upload a sheet.
              </>
            ) : (
              <>
                No characters yet. {viewer.role === "admin" ? "Import Liz from the admin page to see a full sheet." : "They'll appear here as players make them."}
              </>
            )}
          </div>
        ) : (
          <div data-guide="party" className="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-4">
            {party.map((c) => {
              const lvl = c.lvl;
              const ac = c.cls && c.dex !== null ? armorClass(c.items, c.dex, { cls: c.cls, race: c.race, int: c.int }).ac : null;
              const pct = c.hpMax && c.hpCurrent !== null ? Math.max(0, Math.min(100, Math.round((c.hpCurrent / c.hpMax) * 100))) : 0;
              return (
                <div
                  key={c.id}
                  className="relative flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 hover:border-line-2"
                >
                  <div className="flex items-center gap-4">
                    <Portrait name={c.name} src={c.portrait} size="card" />
                    <div className="flex min-w-0 flex-col gap-1">
                      {/* The link stretches over the whole card; the delete control sits above it. */}
                      <Link
                        href={`/characters/${c.id}`}
                        className="font-display text-[28px] leading-none after:absolute after:inset-0 after:rounded-2xl"
                      >
                        {c.name}
                      </Link>
                      <div className="text-sm text-muted">
                        {c.race ? cap(c.race) : "Still being built"} {c.cls ? CLASS_NAMES[c.cls] : ""}
                        {c.alignment ? ` · ${cap(c.alignment)}` : ""}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {lvl && (
                          <Chip tone="lime">
                            Level {lvl.level}
                            {lvl.pastNine ? "+" : ""} · {lvl.title}
                          </Chip>
                        )}
                        {ac !== null && <Chip>AC {ac}</Chip>}
                        {levelUp.has(c.id) && <Chip tone="amber">Level up</Chip>}
                        {c.deity && <Chip>{c.deity}</Chip>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-muted">Hit points</span>
                      <span className="font-mono">
                        {c.hpMax === null ? "Not rolled" : `${c.hpCurrent} / ${c.hpMax}`}
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
                  {can.deleteCharacter(viewer, c) && (
                    <div className="-mt-2 flex justify-end">
                      <DeleteCharacterButton id={c.id} name={c.name} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
