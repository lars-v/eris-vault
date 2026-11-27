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
import { classesFor, RACES, STARTING_XP } from "@/lib/rules/creation";
import { keepsEveryClass } from "@/lib/rules/elf";
import { HIT_DIE_ADJUST } from "@/lib/rules/dice";
import { bandFor, carriedUnits, unknownUnitItems } from "@/lib/rules/encumbrance";
import { CATALOG, classAllows, EQUIPMENT_SOURCE, KIT_MAX_QUANTITY } from "@/lib/rules/equipment";
import { requireUser } from "@/lib/session";
import {
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
import { KitPicker, type KitRow } from "./kit";

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

  const staff = can.approve(viewer);
  // Players can delete until Jay approves (can.deleteCharacter); Jay deletes from the sheet.
  const canDelete = (c.status === "draft" || c.status === "submitted") && can.deleteCharacter(viewer, c);
  const cls: CharacterClass | null = (c.classes.find((k) => k.active) ?? c.classes[0])?.class ?? null;
  const totals = c.abilityRoll?.totals ?? [];
  const scoresDone = ABILITIES.every((a) => c[a] !== null);
  // An elf keeps a record for both of its classes (WW p. 10).
  const classesDone = !keepsEveryClass(c.race) || c.classes.length === classesFor("elf").length;
  const identityDone = Boolean(c.race && cls && c.alignment && c.name !== "Unnamed adventurer") && classesDone;
  // Hit points come from the 1st-level roll, or from the sheet for an imported character.
  const hpLocked = Boolean(c.hpRollId) || c.classes.some((k) => k.hpMax !== null);
  const hpDone = c.classes.length > 0 && c.classes.every((k) => k.hpMax !== null) && classesDone;
  const hpToRoll = c.classes.filter((k) => k.hpMax === null);
  // What an elf shares between its classes: 5,000 new (Jay's ruling starting-xp), or what they hold once rolled.
  const xpTotal = hpLocked ? c.classes.reduce((n, k) => n + k.xp, 0) : STARTING_XP;
  const units = carriedUnits(c.items);
  const unknown = unknownUnitItems(c.items);
  const band = bandFor(units);
  const darkSightDone = c.race !== "dwarf" || Boolean(c.darkSightRollId);
  const ready = scoresDone && identityDone && hpDone && darkSightDone && Boolean(c.goldRollId);
  const hpRolls = c.classes.map((k) => ({ k, roll: c.rolls.find((r) => r.id === k.hpRollId) }));
  const darkSightRoll = c.rolls.find((r) => r.id === c.darkSightRollId);
  const goldRoll = c.rolls.find((r) => r.id === c.goldRollId);
  // The gear dialog manages price-list items that aren't magic (see setKit).
  const managed = c.items.filter((i) => i.catalogKey && !i.isMagic);
  const kitQty: Record<string, number> = {};
  for (const i of managed) kitQty[i.catalogKey!] = (kitQty[i.catalogKey!] ?? 0) + i.quantity;
  const otherUnits = carriedUnits(c.items.filter((i) => !managed.includes(i)));
  const kitRows: KitRow[] = cls
    ? CATALOG.map((i) => {
        const allowed = classAllows({ cls, race: c.race, int: c.int }, i);
        return { key: i.key, name: i.name, category: i.category, cost: i.cost, costGp: i.costGp, enc: i.enc, why: allowed.ok ? null : allowed.why };
      })
    : [];
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
      <main className="mx-auto flex max-w-[1080px] flex-col gap-5 px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader eyebrow={c.status === "draft" ? "New character · draft" : staff ? `Editing as ${viewer.role}` : "With Jay · not yet approved"} title={c.name}>
          <Link href={`/characters/${id}`} className="inline-flex min-h-11 items-center rounded-xl border border-line-2 px-4 text-sm text-soft">
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
          <div role="alert" className="rounded-xl border border-ember-edge bg-ember-wash px-4 py-3 text-sm text-ember">
            {error}
          </div>
        )}

        {c.grants.length > 0 && (
          <Panel title="Re-rolls granted" className="border-amber-edge">
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
            xpTotal={xpTotal}
            initial={{
              name: c.name,
              race: c.race,
              cls,
              alignment: c.alignment,
              deity: c.deity,
              xp: Object.fromEntries(c.classes.map((k) => [k.class, k.xp])),
            }}
          />
          {!classesDone && c.race === "elf" && c.classes.length > 0 && (
            <p className="text-sm text-amber">
              This elf has a record for one class only. Share its XP above and save, then roll the other class&apos;s hit points
              in step 3 (WW p. 10).
            </p>
          )}
          <p className="text-xs leading-relaxed text-subtle">
            Dwarves are fighting-men; elves keep both fighting-man and magic-user, begin as one, and switch on the sheet;
            halflings are fighting-men or thieves; thieves are neutral or chaotic. Race and class are fixed once hit points
            are rolled.
          </p>
        </Step>

        <Step n={3} title="Hit points" done={hpDone} aside="WW pp. 5-6" guide="hp">
          {hpRolls
            .filter((r) => r.k.hpMax !== null)
            .map(({ k, roll }) => (
              <div key={k.id} className="flex flex-wrap items-center gap-3">
                {c.classes.length > 1 && <span className="w-28 text-sm font-semibold">{CLASS_NAMES[k.class]}</span>}
                {roll ? (
                  <>
                    <DiceFaces faces={roll.dice[0]} />
                    <span className="text-sm text-muted">{roll.formula}</span>
                  </>
                ) : (
                  <span className="text-sm text-muted">From the uploaded sheet</span>
                )}
                <span className="font-mono text-3xl">{k.hpMax} hp</span>
              </div>
            ))}
          {(hpToRoll.length > 0 || c.classes.length === 0) &&
            (scoresDone && cls && classesDone ? (
              <form action={rollHitPoints} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="id" value={id} />
                <span className="text-sm text-muted">
                  {hpToRoll.map((k, i) => (
                    <span key={k.id}>
                      {i > 0 && "; "}
                      1d6{HIT_DIE_ADJUST[k.class] ? (HIT_DIE_ADJUST[k.class] > 0 ? ` + ${HIT_DIE_ADJUST[k.class]}` : ` − 1`) : ""} for a{" "}
                      {CLASS_NAMES[k.class]}
                    </span>
                  ))}
                  , plus your Constitution modifier ({formatModifier(abilityModifier(c.con!))}), at least 3.
                  {c.race === "elf" && " An elf rolls once for each class and keeps the two apart (WW p. 10; Jay's ruling)."}
                  {c.race === "dwarf" && " A dwarf also rolls 1d6 for sight in the dark: a 1 or 2 sees up to 30' underground (WW p. 10; Jay's ruling)."}
                </span>
                <SubmitButton pendingText="Rolling…">{hpToRoll.length > 1 ? "Roll hit points for both" : "Roll hit points"}</SubmitButton>
              </form>
            ) : (
              <p className="text-sm text-subtle">{classesDone ? "Save abilities and a class first." : "Save the elf's XP for both classes first."}</p>
            ))}
          {darkSightRoll && (
            <div className="flex flex-wrap items-center gap-3">
              <DiceFaces faces={darkSightRoll.dice[0]} />
              <span className="text-sm text-muted">
                Sight in the dark: {c.darkSight ? "sees up to 30' in darkness underground" : "no"} (WW p. 10; Jay&apos;s ruling).
              </span>
            </div>
          )}
          <p className="text-xs leading-relaxed text-subtle">
            New characters start at 5,000 XP (Jay&apos;s ruling). Hit points for the levels it reaches are rolled on the sheet once the
            character is with Jay, one die per level.
          </p>
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
            Pick freely from the price list; Jay approves the kit. Anyone may carry anything; class limits are about using it
            (Jay&apos;s ruling). Thieves use small or normal weapons, leather at most and no shield (WW p. 9). Magic-users
            other than elves use daggers only (Men &amp; Magic p. 6), plus a staff with Intelligence 15+ (WW p. 7). Clerics
            use non-edged weapons only (Jay&apos;s ruling). Jay judges anything the books leave open.
          </p>
          <p className="text-sm text-muted">
            Each new character also starts with one magic item (Jay&apos;s ruling). Jay adds it to the sheet.
          </p>
          {cls ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <KitPicker id={id} rows={kitRows} initial={kitQty} otherUnits={otherUnits} max={KIT_MAX_QUANTITY} />
                <form action={randomKit}>
                  <input type="hidden" name="id" value={id} />
                  <SubmitButton tone="plain" pendingText="Packing…">
                    Random basic kit
                  </SubmitButton>
                </form>
              </div>
              <span className="text-xs text-subtle">
                Random basic kit replaces the price-list items with a weapon and armor your class may use, its tools, and 4
                to 6 pieces of gear. Magic items and items Jay added stay. Clerics get a non-edged weapon (Jay&apos;s ruling). Not a roll, so it isn&apos;t logged.
              </span>
            </div>
          ) : (
            <p className="text-sm text-subtle">Choose a class first, so class limits can be checked.</p>
          )}
          {c.items.length > 0 && (
            <ul className="flex flex-col divide-y divide-rule">
              {c.items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-[15px]">
                  <span>
                    {i.quantity > 1 ? `${i.quantity} × ` : ""}
                    {i.name}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-subtle">{i.encUnits === null ? "weight unknown" : `${i.encUnits * i.quantity} unit${i.encUnits * i.quantity === 1 ? "" : "s"}`}</span>
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
            Encumbrance: <span className="font-mono">{units}</span> units ({band.name}
            {band.move ? `, move ${band.move}` : ""}). Weights from Woundwort&apos;s Warren p. 18, bands from p. 16.
            {unknown > 0 && (
              <span className="text-amber">
                {" "}
                {unknown} item{unknown === 1 ? " has" : "s have"} no weight, so this is a floor.
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
          ) : c.status === "submitted" ? (
            <span className="max-w-[560px] text-sm text-muted">
              Sent to Jay. You can keep changing it until Jay approves it. Each change saves as you go and shows in
              Jay&apos;s log.
            </span>
          ) : (
            <span className="text-sm text-muted">Status: {c.status}</span>
          )}
          {canDelete && (
            <form action={deleteDraft}>
              <input type="hidden" name="id" value={id} />
              <SubmitButton tone="ember" pendingText="Deleting…">
                {c.status === "draft" ? "Delete draft" : "Delete character"}
              </SubmitButton>
            </form>
          )}
        </div>
        {canDelete && <p className="text-xs text-subtle">Deleting keeps the character&apos;s rolls in the roll log.</p>}
      </main>
    </>
  );
}
