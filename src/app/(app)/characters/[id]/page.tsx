import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Chip, Panel } from "@/components/ui";
import { getCharacter } from "@/lib/queries";
import { ABILITIES, ABILITY_NAMES, ABILITY_SOURCE, abilityModifier, formatModifier } from "@/lib/rules/abilities";
import { ADVANCEMENT_SOURCE, CLASS_NAMES, levelFor } from "@/lib/rules/advancement";
import { bandFor, carriedUnits, ENCUMBRANCE_SOURCE } from "@/lib/rules/encumbrance";
import { requireUser } from "@/lib/session";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function CharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireUser();
  const { id } = await params;
  const c = await getCharacter(id);
  if (!c) notFound();

  const active = c.classes.find((k) => k.active) ?? c.classes[0];
  const lvl = active ? levelFor(active.class, active.xp) : null;
  const units = carriedUnits(c.items);
  const band = bandFor(units);
  const xpPct =
    lvl && active && lvl.nextXp ? Math.round(((active.xp - lvl.startXp) / (lvl.nextXp - lvl.startXp)) * 100) : 100;

  return (
    <>
      <Nav viewer={viewer} active="party" />
      <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-10 sm:px-8">
        <header className="flex flex-wrap items-center gap-6 rounded-2xl border border-line bg-surface p-6">
          <div className="flex h-32 w-26 flex-none items-center justify-center rounded-[50%] border-2 border-lime font-display text-4xl text-lime">
            {c.name
              .split(" ")
              .filter((w) => /^[A-Z]/.test(w))
              .map((w) => w[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div className="flex min-w-0 flex-[999_1_380px] flex-col gap-2">
            <h1 className="font-display text-5xl leading-none text-parchment-2">{c.name}</h1>
            <div className="text-[#c9c5b4]">
              {cap(c.race)} {active ? CLASS_NAMES[active.class] : ""} · {cap(c.alignment)}
              {c.deity ? ` · Patron: ${c.deity}` : ""}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {lvl && (
                <Chip tone="lime">
                  Level {lvl.level}
                  {lvl.pastNine ? "+" : ""} · {lvl.title}
                </Chip>
              )}
              {c.status === "submitted" ? <Chip tone="amber">Awaiting Jay</Chip> : <Chip>{cap(c.status)}</Chip>}
              <span className="text-sm text-subtle">Player: {c.ownerName ?? "unknown"}</span>
            </div>
            {lvl && active && (
              <div className="mt-2 flex max-w-[520px] flex-col gap-1.5">
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted">{active.xp.toLocaleString("en-US")} XP</span>
                  <span className="text-subtle">
                    {lvl.nextTitle && lvl.nextXp
                      ? `${lvl.nextTitle} at ${lvl.nextXp.toLocaleString("en-US")}`
                      : "10th level waits on a GM ruling"}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#262920]">
                  <div className="h-full bg-lime" style={{ width: `${Math.max(0, Math.min(100, xpPct))}%` }} />
                </div>
              </div>
            )}
          </div>
        </header>

        {c.importFlags.length > 0 && (
          <Panel title={`Import flags for Jay · ${c.importFlags.length}`} className="border-[#5e4720]">
            <ul className="flex flex-col divide-y divide-[#262920]">
              {c.importFlags.map((f) => (
                <li key={f.title} className="flex flex-col gap-1 py-3">
                  <span className="font-semibold">{f.title}</span>
                  <span className="text-sm text-muted">{f.body}</span>
                  <span className="font-mono text-xs text-subtle">{f.source}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <div className="flex flex-wrap items-start gap-5">
          <Panel title="Abilities" aside={ABILITY_SOURCE} className="min-w-0 flex-[1_1_360px]">
            {ABILITIES.map((a) => {
              const score = c[a];
              const mod = abilityModifier(score);
              return (
                <div key={a} className="flex items-center gap-4 rounded-xl border border-line px-4 py-2.5">
                  <div className="relative h-12 w-14 flex-none">
                    <div className="absolute inset-0 bg-[#6c7f3a] [clip-path:polygon(25%_3%,75%_3%,100%_50%,75%_97%,25%_97%,0_50%)]" />
                    <div className="absolute inset-[2px] flex items-center justify-center bg-surface font-mono text-xl [clip-path:polygon(25%_3%,75%_3%,100%_50%,75%_97%,25%_97%,0_50%)]">
                      {score}
                    </div>
                  </div>
                  <div className="flex-1 text-sm font-semibold tracking-wide">{ABILITY_NAMES[a].toUpperCase()}</div>
                  <div
                    className={`min-w-11 rounded-lg px-2 py-1.5 text-center font-mono ${
                      mod > 0 ? "bg-[#222c17] text-lime" : mod < 0 ? "bg-[#2e1a15] text-ember" : "bg-surface-2 text-muted"
                    }`}
                  >
                    {formatModifier(mod)}
                  </div>
                </div>
              );
            })}
          </Panel>

          <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Panel title="Hit points">
                <div className="font-mono text-4xl">
                  {c.hpCurrent}
                  <span className="text-lg text-subtle"> / {c.hpMax}</span>
                </div>
              </Panel>
              <Panel title="Saving throw" aside={active ? ADVANCEMENT_SOURCE[active.class] : undefined}>
                <div className="font-mono text-4xl">{lvl?.save ?? "?"}</div>
                <div className="text-xs text-subtle">Class and race bonuses arrive with the rules engine.</div>
              </Panel>
            </div>
            <Panel title="Encumbrance" aside={ENCUMBRANCE_SOURCE}>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-4xl">
                  {units}
                  <span className="text-lg text-subtle"> of 25 units</span>
                </span>
                <span className="text-right">
                  <span className="block text-lg font-semibold">{band.name}</span>
                  <span className="text-sm text-subtle">{band.move ? `Move ${band.move}` : "Can't move"}</span>
                </span>
              </div>
              <div className="text-xs text-subtle">Magic gear counts 0 (campaign ruling).</div>
            </Panel>
            <Panel title="Coins">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className={`rounded-lg p-2 ${c.coinsGp < 0 ? "bg-[#2e1a15] text-ember" : "bg-surface-2"}`}>
                  <div className="font-mono text-xl">{c.coinsGp}</div>
                  <div className="text-xs text-muted">gold</div>
                </div>
                <div className="rounded-lg bg-surface-2 p-2">
                  <div className="font-mono text-xl">{c.coinsSp}</div>
                  <div className="text-xs text-muted">silver</div>
                </div>
                <div className="rounded-lg bg-surface-2 p-2">
                  <div className="font-mono text-xl">{c.coinsCp}</div>
                  <div className="text-xs text-muted">copper</div>
                </div>
              </div>
            </Panel>
          </div>

          <Panel title={`Gear · ${c.items.length}`} className="min-w-0 flex-[1_1_320px]">
            {c.items.length === 0 ? (
              <p className="text-sm text-muted">Nothing carried.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[#262920]">
                {c.items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-[15px]">
                    <span className="flex flex-col">
                      <span>{i.name}</span>
                      {i.isMagic && <span className="text-xs text-lime">Magic: counts 0</span>}
                    </span>
                    <span className="font-mono">{i.isMagic ? 0 : i.encUnits * i.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
            {c.notes && <p className="border-t border-[#262920] pt-3 text-sm text-muted">{c.notes}</p>}
          </Panel>
        </div>
      </main>
    </>
  );
}
