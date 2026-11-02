import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DiceFaces } from "@/components/Dice";
import { Guide } from "@/components/Guide";
import { Nav } from "@/components/Nav";
import { Chip, PageHeader, Panel } from "@/components/ui";
import type { CharacterClass, Race } from "@/db/schema";
import { buildSteps } from "@/lib/guide";
import { getCharacter } from "@/lib/queries";
import { can } from "@/lib/roles";
import { ABILITIES, ABILITY_NAMES, abilityModifier, formatModifier } from "@/lib/rules/abilities";
import { CLASS_NAMES } from "@/lib/rules/advancement";
import { classesFor, RACES } from "@/lib/rules/creation";
import { HIT_DIE_ADJUST } from "@/lib/rules/dice";
import { bandFor, carriedUnits, unknownUnitItems } from "@/lib/rules/encumbrance";
import { CATALOG, classAllows, EQUIPMENT_SOURCE } from "@/lib/rules/equipment";
import { requireUser } from "@/lib/session";
import {
  addItem,
  deleteDraft,
  randomKit,
  removeItem,
  rollGold,
  rollHitPoints,
  saveAbilities,
  saveIdentity,
  submitCharacter,
  spendRollGrant,
} from "../../actions";
import { AbilityAssign, IdentityForm, SubmitButton } from "./forms";

export const metadata = { title: "Build a character" };

const GRANT_LABEL = { abilities: "ability scores (hit points are rolled again too)", hp: "hit points", gold: "starting gold" };

function Step({ n, title, done, children, aside, guide }: { n: number; title: string; done: boolean; children: React.ReactNode; aside?: string; guide: string }) {
  return (
    <Panel
      guide={guide}
      title={`${n} · ${title}`}
      aside={
        <span className="flex items-center gap-2">
          {aside}
          {done ? <Chip tone="lime">Done</Chip> : <Chip>To do</Chip>}
        </span>
      }
    >
      {children}
    </Panel>
  );
}

export default async function BuildPage({
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
  if (!can.editCoreStats(viewer, c)) redirect(`/characters/${id}`);
  // Imported characters have no app rolls to build on (see lockEditable in ../../actions).
  if (c.source !== "app" && !can.approve(viewer)) redirect(`/characters/${id}`);

  const cls: CharacterClass | null = (c.classes.find((k) => k.active) ?? c.classes[0])?.class ?? null;
  const totals = c.abilityRoll?.totals ?? [];
  const scoresDone = ABILITIES.every((a) => c[a] !== null);
  const identityDone = Boolean(c.race && cls && c.alignment && c.name !== "Unnamed adventurer");
  const hpLocked = Boolean(c.hpRollId);
  const units = carriedUnits(c.items);
  const unknown = unknownUnitItems(c.items);
  const band = bandFor(units);
  const ready = scoresDone && identityDone && Boolean(c.hpRollId) && Boolean(c.goldRollId);
  const hpRoll = c.rolls.find((r) => r.id === c.hpRollId);
  const goldRoll = c.rolls.find((r) => r.id === c.goldRollId);
  const raceClasses = Object.fromEntries(RACES.map((r) => [r, classesFor(r)])) as Record<Race, CharacterClass[]>;

  // Assignment already saved: map each ability back to the set index it came from.
  const initialPicks: Partial<Record<(typeof ABILITIES)[number], number>> = {};
  if (scoresDone) {
    const left = totals.map((t, i) => ({ t, i }));
    for (const ab of ABILITIES) {
      const k = left.findIndex((x) => x.t === c[ab]);
      if (k >= 0) {
        initialPicks[ab] = left[k].i;
        left.splice(k, 1);
      }
    }
  }

  return (
    <>
      <Nav viewer={viewer} active="party" />
      <Guide
        guide="build"
        steps={buildSteps()}
        autoStart={c.status === "draft" && c.ownerId === viewer.userId && !viewer.guidesSeen.includes("build")}
      />
      <main className="mx-auto flex max-w-[1080px] flex-col gap-5 px-4 py-10 sm:px-8">
        <PageHeader eyebrow={c.status === "draft" ? "New character · draft" : `Editing as ${viewer.role}`} title={c.name}>
          <Link href={`/characters/${id}`} className="inline-flex min-h-11 items-center rounded-xl border border-line-2 px-4 text-sm text-[#d6d2c2]">
            View sheet
          </Link>
        </PageHeader>
        <p className="max-w-[720px] text-[15px] leading-relaxed text-muted">
          The server rolls every die, and every roll shows up in the{" "}
          <Link href="/rolls" className="text-moon underline-offset-4 hover:underline">
            roll log
          </Link>{" "}
          for the whole table. Your progress saves as you go. When it&apos;s done, send it to Jay.
        </p>

        {error && (
          <div role="alert" className="rounded-xl border border-[#5c3328] bg-[#2e1a15] px-4 py-3 text-sm text-ember">
            {error}
          </div>
        )}

        {c.grants.length > 0 && (
          <Panel title="Re-rolls granted" className="border-[#5e4720]">
            {c.grants.map((g) => (
              <form key={g.id} action={spendRollGrant} className="flex flex-wrap items-center justify-between gap-3">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="grantId" value={g.id} />
                <span className="text-sm">
                  {g.grantedByName ?? "The GM"} lets you roll {GRANT_LABEL[g.purpose]} again
                  {g.reason ? `: ${g.reason}` : "."} The old roll stays in the log.
                </span>
                <SubmitButton tone="amber" pendingText="Rolling…">
                  Roll again
                </SubmitButton>
              </form>
            ))}
          </Panel>
        )}

        <Step n={1} title="Ability scores" done={scoresDone} aside="WW p. 5" guide="abilities">
          <p className="text-sm text-muted">Six rolls of 3d6. Arrange them as you like: each set goes to one ability.</p>
          <ol className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5">
            {totals.map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
                <span className="whitespace-nowrap text-xs text-subtle">Set {i + 1}</span>
                <DiceFaces faces={c.abilityRoll!.dice[i]} size="sm" />
                <span className="font-mono text-xl">{t}</span>
              </li>
            ))}
          </ol>
          {hpLocked ? (
            <div className="flex flex-wrap gap-2">
              {ABILITIES.map((ab) => (
                <Chip key={ab}>
                  {ABILITY_NAMES[ab]} {c[ab]} ({formatModifier(abilityModifier(c[ab]!))})
                </Chip>
              ))}
              <span className="text-xs text-subtle">Fixed now that hit points are rolled.</span>
            </div>
          ) : (
            <AbilityAssign id={id} totals={totals} initial={initialPicks} action={saveAbilities} />
          )}
        </Step>

        <Step n={2} title="Race, class and alignment" done={identityDone} aside="WW pp. 8-10" guide="identity">
          <IdentityForm
            id={id}
            action={saveIdentity}
            locked={hpLocked}
            raceClasses={raceClasses}
            initial={{ name: c.name, race: c.race, cls, alignment: c.alignment, deity: c.deity }}
          />
          <p className="text-xs leading-relaxed text-subtle">
            Dwarves are fighting-men; elves begin as fighting-man or magic-user and can switch later; halflings are
            fighting-men or thieves; thieves are neutral or chaotic. Race and class are fixed once hit points are rolled.
          </p>
        </Step>

        <Step n={3} title="Hit points" done={Boolean(c.hpRollId)} aside="WW pp. 5-6" guide="hp">
          {hpRoll ? (
            <div className="flex flex-wrap items-center gap-3">
              <DiceFaces faces={hpRoll.dice[0]} />
              <span className="text-sm text-muted">{hpRoll.formula}</span>
              <span className="font-mono text-3xl">{c.hpMax} hp</span>
            </div>
          ) : scoresDone && cls ? (
            <form action={rollHitPoints} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="id" value={id} />
              <span className="text-sm text-muted">
                1d6{HIT_DIE_ADJUST[cls] ? (HIT_DIE_ADJUST[cls] > 0 ? ` + ${HIT_DIE_ADJUST[cls]}` : ` − 1`) : ""} for a{" "}
                {CLASS_NAMES[cls]}, plus your Constitution modifier ({formatModifier(abilityModifier(c.con!))}), at least 3.
              </span>
              <SubmitButton pendingText="Rolling…">Roll hit points</SubmitButton>
            </form>
          ) : (
            <p className="text-sm text-subtle">Save abilities and a class first.</p>
          )}
        </Step>

        <Step n={4} title="Starting gold" done={Boolean(c.goldRollId)} aside="Men & Magic p. 10" guide="gold">
          {goldRoll ? (
            <div className="flex flex-wrap items-center gap-3">
              <DiceFaces faces={goldRoll.dice[0]} />
              <span className="text-sm text-muted">{goldRoll.formula}</span>
              <span className="font-mono text-3xl">{c.coinsGp} gp</span>
            </div>
          ) : (
            <form action={rollGold} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="id" value={id} />
              <span className="text-sm text-muted">3d6 × 10 gold pieces. By campaign ruling, this is what you have left after buying your kit.</span>
              <SubmitButton pendingText="Rolling…">Roll starting gold</SubmitButton>
            </form>
          )}
        </Step>

        <Step n={5} title="Starting kit" done={c.items.length > 0} aside={EQUIPMENT_SOURCE} guide="kit">
          <p className="text-sm text-muted">
            Pick freely from the price list; Jay approves the kit. Thieves keep to small or normal weapons, leather at
            most and no shield (WW p. 9). Magic-users other than elves carry daggers only (Men &amp; Magic p. 6), plus a
            staff with Intelligence 15+ (WW p. 7). Jay judges anything the books leave open.
          </p>
          {cls ? (
            <form action={addItem} className="flex flex-wrap items-end gap-2.5">
              <input type="hidden" name="id" value={id} />
              <label className="flex min-w-[260px] flex-1 flex-col gap-1.5 text-[13px] text-muted">
                Item
                <select name="key" required defaultValue="" className="min-h-11 rounded-xl border border-line-2 bg-ink px-3 text-[15px] text-parchment">
                  <option value="" disabled>
                    Choose from the price list
                  </option>
                  {(["weapon", "armor", "gear"] as const).map((cat) => (
                    <optgroup key={cat} label={cat === "weapon" ? "Weapons" : cat === "armor" ? "Armor" : "Dungeon gear"}>
                      {CATALOG.filter((i) => i.category === cat).map((i) => {
                        const allowed = classAllows({ cls, race: c.race, int: c.int }, i);
                        return (
                          <option key={i.key} value={i.key} disabled={!allowed.ok}>
                            {i.name} · {i.cost}
                            {allowed.ok ? "" : ` · not for ${CLASS_NAMES[cls].toLowerCase()}s`}
                          </option>
                        );
                      })}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="flex w-24 flex-col gap-1.5 text-[13px] text-muted">
                How many
                <input name="quantity" type="number" min={1} max={20} defaultValue={1} className="min-h-11 rounded-xl border border-line-2 bg-ink px-3 font-mono text-[15px]" />
              </label>
              <SubmitButton tone="plain" pendingText="Adding…">
                Add
              </SubmitButton>
            </form>
          ) : null}
          {cls ? (
            <form action={randomKit} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="id" value={id} />
              <SubmitButton tone="plain" pendingText="Packing…">
                Random basic kit
              </SubmitButton>
              <span className="text-xs text-subtle">
                Replaces the list with a weapon and armor your class may use, its tools, and 4 to 6 pieces of gear. Clerics
                get a non-edged weapon until Jay rules on edged ones. Not a roll, so it isn&apos;t logged.
              </span>
            </form>
          ) : (
            <p className="text-sm text-subtle">Choose a class first, so class limits can be checked.</p>
          )}
          {c.items.length > 0 && (
            <ul className="flex flex-col divide-y divide-[#262920]">
              {c.items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-[15px]">
                  <span>
                    {i.quantity > 1 ? `${i.quantity} × ` : ""}
                    {i.name}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-subtle">{i.encUnits === null ? "weight: awaiting p. 18" : `${i.encUnits * i.quantity} units`}</span>
                    <form action={removeItem}>
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="itemId" value={i.id} />
                      <button type="submit" className="min-h-9 rounded-lg border border-line-2 px-2.5 text-[13px] text-muted hover:text-ember" aria-label={`Remove ${i.name}`}>
                        Remove
                      </button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="rounded-xl bg-surface-2 px-4 py-3 text-sm">
            Encumbrance: <span className="font-mono">{units}</span> units known ({band.name}
            {band.move ? `, move ${band.move}` : ""})
            {unknown > 0 && (
              <span className="text-amber">
                {" "}
                · {unknown} item{unknown === 1 ? "" : "s"} waiting for weights from Woundwort&apos;s Warren p. 18, so this is
                a floor
              </span>
            )}
          </div>
        </Step>

        <div data-guide="send" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-5">
          {c.status === "draft" ? (
            <form action={submitCharacter} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="id" value={id} />
              <SubmitButton tone="amber" pendingText="Sending…">
                Send to Jay for approval
              </SubmitButton>
              {!ready && <span className="text-sm text-subtle">Finish steps 1 to 4 first.</span>}
            </form>
          ) : (
            <span className="text-sm text-muted">Status: {c.status}</span>
          )}
          {c.status === "draft" && (
            <form action={deleteDraft}>
              <input type="hidden" name="id" value={id} />
              <SubmitButton tone="ember" pendingText="Deleting…">
                Delete draft
              </SubmitButton>
            </form>
          )}
        </div>
        <p className="text-xs text-subtle">Deleting a draft keeps its rolls in the roll log.</p>
      </main>
    </>
  );
}
