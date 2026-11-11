import Link from "next/link";
import { notFound } from "next/navigation";
import { DiceFaces, PURPOSE_LABEL } from "@/components/Dice";
import { Nav } from "@/components/Nav";
import { Chip, Panel } from "@/components/ui";
import { getCharacter, sheetsForCharacter, statOverrides } from "@/lib/queries";
import { ABILITIES, ABILITY_NAMES, ABILITY_SOURCE, abilityModifier, formatModifier } from "@/lib/rules/abilities";
import { ADVANCEMENT_SOURCE, cappedLevelFor, CLASS_NAMES } from "@/lib/rules/advancement";
import { bandFor, carriedUnits, ENCUMBRANCE_SOURCE, unknownUnitItems } from "@/lib/rules/encumbrance";
import { CATALOG, catalogItem, classAllows, type Wielder } from "@/lib/rules/equipment";
import { overrideOpen, playStateOpen } from "@/lib/rules/overrides";
import { castsSpells } from "@/lib/rules/spells";
import { can } from "@/lib/roles";
import { requireUser } from "@/lib/session";
import { SubmitButton } from "./build/forms";
import { GearPanel, type GearCatalogRow, type GearItem } from "./GearPanel";
import { LevelPanel } from "./LevelPanel";
import { NotesPanel } from "./NotesPanel";
import { CoinsPanel, HitPointsPanel } from "./PlayStatePanels";
import { StatsEditor } from "./StatsEditor";
import { SpellsPanel } from "./SpellsPanel";
import { approveCharacter, grantReroll, returnToPlayer } from "../actions";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function CharacterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const viewer = await requireUser();
  const { id } = await params;
  const { error } = await searchParams;
  const c = await getCharacter(id);
  if (!c) notFound();

  const active = c.classes.find((k) => k.active) ?? c.classes[0];
  const lvl = active ? cappedLevelFor(c.race, active.class, active.xp) : null;
  const units = carriedUnits(c.items);
  const band = bandFor(units);
  const unknown = unknownUnitItems(c.items);
  const staff = can.approve(viewer);
  // Imported characters have no app rolls, so only Jay and admins open the build page for them.
  const imported = c.source !== "app";
  const canBuild = can.editCoreStats(viewer, c) && (!imported || staff);
  const sheets = staff || c.ownerId === viewer.userId ? await sheetsForCharacter(c.id) : [];
  // Class limits on price-list gear (WW p. 9, M&M pp. 6, 8), shown on the item and in the add list.
  const wielder: Wielder | null = active ? { cls: active.class, race: c.race, int: c.int } : null;
  const limitFor = (key: string | null) => {
    const entry = key ? catalogItem(key) : undefined;
    if (!entry || !wielder) return null;
    const allowed = classAllows(wielder, entry);
    return allowed.ok ? null : allowed.why;
  };
  const gearItems: GearItem[] = c.items.map((i) => ({
    id: i.id,
    name: i.name,
    quantity: i.quantity,
    encUnits: i.encUnits,
    isMagic: i.isMagic,
    location: i.location,
    warn: i.isMagic ? null : limitFor(i.catalogKey),
  }));
  const gearCatalog: GearCatalogRow[] = CATALOG.map((i) => ({
    key: i.key,
    name: i.name,
    category: i.category,
    cost: i.cost,
    enc: i.enc,
    why: limitFor(i.key),
  }));
  // Hit points and coins: the player once approved, Jay and admins once submitted.
  const canPlay = can.editPlayState(viewer, c) && playStateOpen(c.status, staff);
  const canOverride = can.overrideStats(viewer) && overrideOpen(c.status);
  // Who set abilities or maximum hit points by hand. The reason shows to the player and staff.
  const overrides = c.manualFields.length > 0 ? await statOverrides(c.id) : [];
  const seesReason = staff || c.ownerId === viewer.userId;
  const lastSet = (fields: readonly string[]) => overrides.find((o) => o.fields.some((f) => fields.includes(f))) ?? null;
  const handSetNote = (fields: readonly string[]) => {
    const o = lastSet(fields);
    if (!o) return null;
    return (
      <p className="text-xs text-amber">
        Set by hand by {o.actorName ?? "Jay"} on {o.createdAt.toISOString().slice(0, 10)}
        {seesReason && o.reason ? `: ${o.reason}` : "."}
      </p>
    );
  };
  const hpHandSet = c.manualFields.includes("hpMax") ? handSetNote(["hpMax"]) : null;
  const xpPct =
    lvl && active && lvl.nextXp ? Math.round(((active.xp - lvl.startXp) / (lvl.nextXp - lvl.startXp)) * 100) : 100;

  return (
    <>
      <Nav viewer={viewer} active="party" />
      <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
        <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-5 sm:gap-6 sm:p-6">
          <div className="flex h-20 w-16 flex-none items-center justify-center rounded-[50%] border-2 border-lime font-display text-2xl text-lime sm:h-32 sm:w-26 sm:text-4xl">
            {c.name
              .split(" ")
              .filter((w) => /^[A-Z]/.test(w))
              .map((w) => w[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div className="flex min-w-0 flex-[999_1_12rem] flex-col gap-2 sm:basis-[380px]">
            <h1 className="font-display text-4xl leading-none text-parchment-2 sm:text-5xl">{c.name}</h1>
            <div className="text-[#c9c5b4]">
              {c.race ? cap(c.race) : "Race not chosen"} {active ? CLASS_NAMES[active.class] : ""}
              {c.alignment ? ` · ${cap(c.alignment)}` : ""}
              {c.deity ? ` · Patron: ${c.deity}` : ""}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {lvl && (
                <Chip tone="lime">
                  Level {lvl.level}
                  {lvl.pastNine ? "+" : ""} · {lvl.title}
                </Chip>
              )}
              {c.status === "submitted" ? (
                <Chip tone="amber">Awaiting Jay</Chip>
              ) : c.status === "approved" ? (
                <Chip tone="lime">Approved</Chip>
              ) : (
                <Chip>{cap(c.status)}</Chip>
              )}
              {imported && <Chip tone="moon">From a sheet</Chip>}
              <span className="text-sm text-subtle">Player: {c.ownerName ?? "unknown"}</span>
            </div>
            {lvl && active && (
              <div className="mt-2 flex max-w-[520px] flex-col gap-1.5">
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted">{active.xp.toLocaleString("en-US")} XP</span>
                  <span className="text-subtle">
                    {lvl.nextTitle && lvl.nextXp
                      ? `${lvl.nextTitle} at ${lvl.nextXp.toLocaleString("en-US")}`
                      : lvl.level < 9
                        ? `Highest level for a ${c.race} ${CLASS_NAMES[active.class].toLowerCase()} (WW pp. 7-10)`
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

        {error && (
          <div role="alert" className="rounded-xl border border-[#5c3328] bg-[#2e1a15] px-4 py-3 text-sm text-ember">
            {error}
          </div>
        )}

        {(canBuild || staff) && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4">
            {canBuild && (
              <Link href={`/characters/${c.id}/build`} className="inline-flex min-h-11 items-center rounded-xl bg-lime px-4 text-sm font-semibold text-lime-ink">
                {c.status === "draft" ? "Continue building" : "Edit as GM"}
              </Link>
            )}
            {staff && c.status === "submitted" && (
              <form action={approveCharacter}>
                <input type="hidden" name="id" value={c.id} />
                <SubmitButton tone="amber" pendingText="Approving…">
                  Approve
                </SubmitButton>
              </form>
            )}
            {staff && (c.status === "submitted" || c.status === "approved") && (
              <form action={returnToPlayer} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <input type="hidden" name="id" value={c.id} />
                <input name="note" placeholder="Note for the player (optional)" maxLength={300} className="min-h-11 min-w-0 flex-[1_1_10rem] rounded-xl border border-line-2 bg-ink px-3 text-sm sm:w-64 sm:flex-none" />
                <SubmitButton tone="plain" pendingText="Returning…">
                  Return to player
                </SubmitButton>
              </form>
            )}
            {staff && (
              <form action={grantReroll} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <input type="hidden" name="id" value={c.id} />
                <label className="sr-only" htmlFor="reroll-purpose">
                  Roll to grant again
                </label>
                <select id="reroll-purpose" name="purpose" defaultValue={c.levelDice.length === 0 ? "abilities" : "gold"} className="min-h-11 rounded-xl border border-line-2 bg-ink px-2 text-sm">
                  {/* A re-roll of these would undo hit dice rolled for later levels. */}
                  {c.levelDice.length === 0 && <option value="abilities">Ability scores</option>}
                  {c.levelDice.length === 0 && <option value="hp">Hit points</option>}
                  <option value="gold">Starting gold</option>
                </select>
                <input name="reason" placeholder="Reason" maxLength={200} className="min-h-11 min-w-0 flex-[1_1_10rem] rounded-xl border border-line-2 bg-ink px-3 text-sm sm:w-44 sm:flex-none" />
                <SubmitButton tone="plain" pendingText="Granting…">
                  Grant re-roll
                </SubmitButton>
              </form>
            )}
            {canOverride && (
              <StatsEditor
                id={c.id}
                name={c.name}
                alignment={c.alignment}
                deity={c.deity}
                scores={{ str: c.str, int: c.int, wis: c.wis, dex: c.dex, con: c.con, cha: c.cha }}
                hpMax={c.hpMax}
                classes={c.classes.map((k) => ({
                  id: k.id,
                  class: k.class,
                  xp: k.xp,
                  highestHitDie: Math.max(0, ...c.levelDice.filter((d) => d.class === k.class).map((d) => d.level)),
                }))}
                activeClass={active?.class ?? null}
              />
            )}
            {c.grants.length > 0 && <Chip tone="amber">{c.grants.length} re-roll{c.grants.length === 1 ? "" : "s"} waiting</Chip>}
          </div>
        )}

        {sheets.length > 0 && (
          <Panel title="Uploaded sheet" aside="Seen by the player, Jay and admins">
            <ul className="flex flex-col gap-1.5">
              {sheets.map((s) => (
                <li key={s.id} className="text-sm">
                  <a href={`/api/sheets/${s.id}`} target="_blank" rel="noopener" className="text-moon underline-offset-4 hover:underline">
                    {s.filename}
                  </a>{" "}
                  <span className="text-subtle">
                    · uploaded {s.createdAt.toISOString().slice(0, 10)} ·{" "}
                    {Object.keys(s.fields).length > 0 ? `${Object.keys(s.fields).length} fields read` : "typed in by hand"}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

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
              if (score === null) {
                return (
                  <div key={a} className="flex items-center justify-between rounded-xl border border-dashed border-line px-4 py-3 text-sm text-subtle">
                    <span className="font-semibold tracking-wide">{ABILITY_NAMES[a].toUpperCase()}</span>
                    <span>Not assigned yet</span>
                  </div>
                );
              }
              const mod = abilityModifier(score);
              return (
                <div key={a} className="flex items-center gap-4 rounded-xl border border-line px-4 py-2.5">
                  <div className="relative h-12 w-14 flex-none">
                    <div className="absolute inset-0 bg-[#6c7f3a] [clip-path:polygon(25%_3%,75%_3%,100%_50%,75%_97%,25%_97%,0_50%)]" />
                    <div className="absolute inset-[2px] flex items-center justify-center bg-surface font-mono text-xl [clip-path:polygon(25%_3%,75%_3%,100%_50%,75%_97%,25%_97%,0_50%)]">
                      {score}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col text-sm font-semibold tracking-wide">
                    {ABILITY_NAMES[a].toUpperCase()}
                    {c.manualFields.includes(a) && <span className="text-xs font-normal tracking-normal text-amber">Set by hand</span>}
                  </div>
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
            {handSetNote(ABILITIES)}
          </Panel>

          <div className="@container flex min-w-0 flex-[1_1_380px] flex-col gap-4">
            <div className="grid gap-3 @xs:grid-cols-2">
              <HitPointsPanel id={c.id} current={c.hpCurrent} max={c.hpMax} canEdit={canPlay} staff={staff} handSet={hpHandSet} />
              <Panel title="Saving throw" aside={active ? ADVANCEMENT_SOURCE[active.class] : undefined}>
                <div className="font-mono text-4xl">{lvl?.save ?? "?"}</div>
                <div className="text-xs text-subtle">Class and race bonuses arrive with the rules engine.</div>
              </Panel>
            </div>
            <Panel title="Encumbrance" aside={ENCUMBRANCE_SOURCE}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
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
              {unknown > 0 && (
                <div className="text-xs text-amber">
                  {unknown} item{unknown === 1 ? "" : "s"} with no weight entered, so the total is a floor. Weights are on Woundwort&apos;s Warren p. 18.
                </div>
              )}
            </Panel>
            <CoinsPanel id={c.id} gp={c.coinsGp} sp={c.coinsSp} cp={c.coinsCp} canEdit={canPlay} />
          </div>

          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
            <GearPanel id={c.id} items={gearItems} catalog={gearCatalog} canEdit={can.editGear(viewer, c)} staff={staff} />
            {(c.notes || can.editPlayState(viewer, c)) && (
              <NotesPanel id={c.id} notes={c.notes} canEdit={can.editPlayState(viewer, c)} />
            )}
          </div>
        </div>
        {active && (c.status === "submitted" || c.status === "approved") && (
          <LevelPanel
            characterId={c.id}
            race={c.race}
            classes={c.classes}
            firstLevelCounted={imported || Boolean(c.hpRollId)}
            conModifier={c.con === null ? 0 : abilityModifier(c.con)}
            levelDice={c.levelDice}
            canRoll={can.editPlayState(viewer, c)}
            canAward={can.awardXp(viewer)}
          />
        )}

        {active && lvl && castsSpells(active.class) && (
          <SpellsPanel
            id={c.id}
            cls={active.class}
            level={lvl.level}
            wis={c.wis}
            recorded={c.spellsKnown}
            prepared={c.spellsPrepared}
            canPrepare={can.editPlayState(viewer, c)}
            staff={staff}
          />
        )}
        <Panel title={`Rolls · ${c.rolls.length}`} aside="Insert-only; see the full roll log">
          {c.rolls.length === 0 ? (
            <p className="text-sm text-muted">
              {imported ? "No rolls recorded for this character (imported from a sheet)." : "No rolls recorded for this character yet."}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[#262920]">
              {c.rolls.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <span className="text-sm">
                    {PURPOSE_LABEL[r.purpose] ?? r.purpose} <span className="text-subtle">by {r.rollerName ?? "someone"}</span>
                    {r.id !== c.abilityRollId && r.id !== c.hpRollId && r.id !== c.goldRollId && (
                      <span className="ml-2 text-xs text-amber">replaced by a granted re-roll</span>
                    )}
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
