import Link from "next/link";
import { notFound } from "next/navigation";
import { DiceFaces, PURPOSE_LABEL } from "@/components/Dice";
import { Nav } from "@/components/Nav";
import { Portrait } from "@/components/Portrait";
import { Chip, Panel } from "@/components/ui";
import { getCharacter, rulingsByKey, sheetsForCharacter, statOverrides } from "@/lib/queries";
import { ABILITIES, ABILITY_NAMES, ABILITY_SOURCE, abilityModifier, formatModifier } from "@/lib/rules/abilities";
import { armorClass, armorClassWorking, ARMOR_CLASS_SOURCE } from "@/lib/rules/armor";
import { ADVANCEMENT_SOURCE, cappedLevelFor, CLASS_NAMES } from "@/lib/rules/advancement";
import { bandFor, carriedUnits, ENCUMBRANCE_SOURCE, unknownUnitItems } from "@/lib/rules/encumbrance";
import { CATALOG, catalogItem, classAllows, type Wielder } from "@/lib/rules/equipment";
import { overrideOpen, playStateOpen } from "@/lib/rules/overrides";
import { againstText, CLASS_SAVE_BONUSES, overlappingForms, RACE_SAVE_BONUSES } from "@/lib/rules/saves";
import { castsSpells } from "@/lib/rules/spells";
import { staffCapacity } from "@/lib/rules/staff";
import { weaponTable } from "@/lib/rules/weapons";
import { can } from "@/lib/roles";
import { requireUser } from "@/lib/session";
import { SubmitButton } from "./build/forms";
import { GearPanel, type GearCatalogRow, type GearItem } from "./GearPanel";
import { CombatPanel } from "./CombatPanel";
import { LevelPanel } from "./LevelPanel";
import { NotesPanel } from "./NotesPanel";
import { PortraitEditor } from "./PortraitEditor";
import { CoinsPanel, HitPointsPanel } from "./PlayStatePanels";
import { StatsEditor } from "./StatsEditor";
import { SpellsPanel } from "./SpellsPanel";
import { SpellStaffPanel, STAFF_RULINGS } from "./SpellStaffPanel";
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
  const ac = armorClass(c.items, c.dex, wielder);
  // Saving throw bonuses (WW p. 21): each class's row, then the race's, listed once.
  const saveBonuses = [...c.classes.flatMap((k) => CLASS_SAVE_BONUSES[k.class]), ...(c.race ? RACE_SAVE_BONUSES[c.race] : [])];
  const saveOverlap = overlappingForms(saveBonuses);
  const weapons = weaponTable(c.items, { str: c.str, dex: c.dex, race: c.race, wielder });
  const gearItems: GearItem[] = c.items.map((i) => ({
    id: i.id,
    name: i.name,
    quantity: i.quantity,
    encUnits: i.encUnits,
    isMagic: i.isMagic,
    location: i.location,
    isSpellFocus: i.isSpellFocus === true,
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
  const canEditPortrait = can.editPortrait(viewer, c);
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
  // The spell staff or wand (WW pp. 5, 7): shown while the character can store
  // spells, has a staff set, or has ever stored one.
  const staffCap = staffCapacity(c.classes.map((k) => k.class), c.race, c.int);
  const showStaff = staffCap > 0 || c.items.some((i) => i.isSpellFocus) || c.staffEvents.length > 0;
  const staffRulings = showStaff ? await rulingsByKey(STAFF_RULINGS) : [];
  const xpPct =
    lvl && active && lvl.nextXp ? Math.round(((active.xp - lvl.startXp) / (lvl.nextXp - lvl.startXp)) * 100) : 100;

  return (
    <>
      <Nav viewer={viewer} active="party" />
      <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
        <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-5 sm:gap-6 sm:p-6">
          {canEditPortrait ? (
            // Clicking the medallion opens the same file picker as the buttons in PortraitEditor.
            <label
              htmlFor={`portrait-${c.id}`}
              title={c.portrait ? "Change picture" : "Add a picture"}
              className="group relative flex-none cursor-pointer rounded-[50%] transition hover:ring-2 hover:ring-lime/50 hover:brightness-110"
            >
              <Portrait name={c.name} src={c.portrait} size="sheet" />
              {/* No picture yet: a "+" over the initials on hover says one can be added. */}
              {!c.portrait && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0.5 flex items-center justify-center rounded-[50%] bg-ink font-display text-4xl text-lime opacity-0 transition-opacity group-hover:opacity-100 sm:text-6xl"
                >
                  +
                </span>
              )}
            </label>
          ) : c.portrait ? (
            <a href={c.portrait} target="_blank" rel="noopener" title="Open the full picture" className="flex-none rounded-[50%]">
              <Portrait name={c.name} src={c.portrait} size="sheet" />
            </a>
          ) : (
            <Portrait name={c.name} src={null} size="sheet" />
          )}
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
            {canEditPortrait && <PortraitEditor id={c.id} name={c.name} hasPortrait={c.portrait !== null} />}
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
                {c.status === "draft" ? "Continue building" : staff ? "Edit as GM" : "Make changes"}
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
                  highestHitDie: Math.max(0, ...c.levelDice.filter((d) => d.class === k.class && !d.lostAt).map((d) => d.level)),
                }))}
                activeClass={active?.class ?? null}
              />
            )}
            {c.grants.length > 0 && <Chip tone="amber">{c.grants.length} re-roll{c.grants.length === 1 ? "" : "s"} waiting</Chip>}
          </div>
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
            <HitPointsPanel id={c.id} current={c.hpCurrent} max={c.hpMax} canEdit={canPlay} staff={staff} handSet={hpHandSet} />
            <div className="grid gap-3 @sm:grid-cols-2">
              <Panel title="Armor class" aside={ARMOR_CLASS_SOURCE}>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-4xl">{ac.ac}</span>
                  <span className="text-sm text-muted">{ac.wearing}</span>
                </div>
                {ac.withMagic !== null && (
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-2xl">{ac.withMagic}</span>
                    <span className="text-sm text-muted">with the armor&apos;s +{ac.armorBonus} against attack rolls</span>
                  </div>
                )}
                <p className="text-xs text-subtle">
                  {armorClassWorking(ac)} Lower is better.
                </p>
                {ac.notes.map((n) => (
                  <p key={n.text} className={`text-xs ${n.tone === "amber" ? "text-amber" : "text-subtle"}`}>
                    {n.text}
                  </p>
                ))}
              </Panel>
              <Panel title="Saving throw" aside={active ? `${ADVANCEMENT_SOURCE[active.class].replace("Woundwort's Warren p.", "WW pp.")}, 21` : undefined}>
                {c.classes.length > 1 ? (
                  // Elves keep a separate saving throw for each class (WW p. 21).
                  <div className="flex flex-wrap gap-x-5 gap-y-1">
                    {c.classes.map((k) => (
                      <span key={k.id} className="flex items-baseline gap-2">
                        <span className="font-mono text-4xl">{cappedLevelFor(c.race, k.class, k.xp).save}</span>
                        <span className="text-sm text-muted">{CLASS_NAMES[k.class]}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="font-mono text-4xl">{lvl?.save ?? "?"}</div>
                )}
                {saveBonuses.length > 0 && (
                  <ul className="flex flex-col gap-0.5 text-sm">
                    {saveBonuses.map((b, i) => (
                      <li key={i}>
                        <span className="font-mono">{formatModifier(b.bonus)}</span> vs {againstText(b.against)}{" "}
                        <span className="text-xs text-subtle">({b.who})</span>
                      </li>
                    ))}
                  </ul>
                )}
                {saveOverlap.length > 0 && (
                  <p className="text-xs text-amber">
                    Class and race both give a bonus vs {againstText(saveOverlap)}. Whether they add together waits on Jay (save-bonus-stacking).
                  </p>
                )}
                <p className="text-xs text-subtle">
                  One number for every saving throw (WW p. 21). Wisdom vs charms and illusions is the referee&apos;s call (wis-vs-mind).
                </p>
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
          </div>
        </div>
        {active && (c.status === "submitted" || c.status === "approved") && (
          <LevelPanel
            characterId={c.id}
            race={c.race}
            alignment={c.alignment}
            wis={c.wis}
            classes={c.classes}
            firstLevelCounted={imported || Boolean(c.hpRollId)}
            hpMax={c.hpMax}
            conModifier={c.con === null ? 0 : abilityModifier(c.con)}
            levelDice={c.levelDice}
            canRoll={can.editPlayState(viewer, c)}
            canAward={can.awardXp(viewer)}
          />
        )}

        {active && <CombatPanel race={c.race} alignment={c.alignment} str={c.str} dex={c.dex} classes={c.classes} weapons={weapons} />}

        {active && lvl && castsSpells(active.class) && (
          <SpellsPanel
            id={c.id}
            cls={active.class}
            level={lvl.level}
            wis={c.wis}
            prepared={c.spellsPrepared}
            canPrepare={can.editSpells(viewer, c)}
          />
        )}
        {showStaff && (
          <SpellStaffPanel
            id={c.id}
            capacity={staffCap}
            int={c.int}
            isElf={c.race === "elf"}
            items={c.items}
            events={c.staffEvents}
            rulings={staffRulings}
            canUse={can.useSpellStaff(viewer, c) && playStateOpen(c.status, staff)}
            canVoid={can.voidStoredSpell(viewer)}
            canFocus={can.editGear(viewer, c)}
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

        {(c.notes || can.editPlayState(viewer, c)) && (
          <NotesPanel id={c.id} notes={c.notes} canEdit={can.editPlayState(viewer, c)} />
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
      </main>
    </>
  );
}
