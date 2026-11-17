import Link from "next/link";
import type { ReactNode } from "react";
import { DiceFaces, PURPOSE_LABEL } from "@/components/Dice";
import { Panel } from "@/components/ui";
import type { getCharacter, sheetsForCharacter } from "@/lib/queries";
import { ABILITIES, ABILITY_NAMES, ABILITY_SOURCE, abilityModifier, formatModifier } from "@/lib/rules/abilities";
import { ADVANCEMENT_SOURCE, cappedLevelFor, CLASS_NAMES } from "@/lib/rules/advancement";
import { armorClassWorking, ARMOR_CLASS_SOURCE, type ArmorClass } from "@/lib/rules/armor";
import { bandFor, carriedUnits, ENCUMBRANCE_SOURCE, unknownUnitItems } from "@/lib/rules/encumbrance";
import { againstText, CLASS_SAVE_BONUSES, overlappingForms, RACE_SAVE_BONUSES } from "@/lib/rules/saves";

/** Everything the sheet page loads for one character. */
export type CharacterSheet = NonNullable<Awaited<ReturnType<typeof getCharacter>>>;

const divider = "divide-y divide-[#262920]";

/** The six scores and their modifiers (WW p. 5). */
export function AbilitiesPanel({ c, handSet }: { c: CharacterSheet; handSet: ReactNode }) {
  return (
    <Panel title="Abilities" aside={ABILITY_SOURCE}>
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
          <div key={a} className="flex items-center gap-4 rounded-xl border border-line px-4 py-2">
            <div className="relative h-12 w-14 flex-none">
              <div className="absolute inset-0 bg-[#6c7f3a] [clip-path:polygon(25%_3%,75%_3%,100%_50%,75%_97%,25%_97%,0_50%)]" />
              <div className="absolute inset-0.5 flex items-center justify-center bg-surface font-mono text-xl [clip-path:polygon(25%_3%,75%_3%,100%_50%,75%_97%,25%_97%,0_50%)]">
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
      {handSet}
    </Panel>
  );
}

/** Armor class from worn armor, shield and Dexterity (WW pp. 5, 9, 17; magic armor M&T p. 30). */
export function ArmorClassPanel({ ac }: { ac: ArmorClass }) {
  return (
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
      <p className="text-xs text-subtle">{armorClassWorking(ac)} Lower is better.</p>
      {ac.notes.map((n) => (
        <p key={n.text} className={`text-xs ${n.tone === "amber" ? "text-amber" : "text-subtle"}`}>
          {n.text}
        </p>
      ))}
    </Panel>
  );
}

/** One saving throw number per class, then each class's and the race's bonuses (WW p. 21). */
export function SavingThrowPanel({ c }: { c: CharacterSheet }) {
  const active = c.classes.find((k) => k.active) ?? c.classes[0];
  const bonuses = [...c.classes.flatMap((k) => CLASS_SAVE_BONUSES[k.class]), ...(c.race ? RACE_SAVE_BONUSES[c.race] : [])];
  const overlap = overlappingForms(bonuses);
  const source = active ? `${ADVANCEMENT_SOURCE[active.class].replace(" p. ", " pp. ")}, 21` : "Woundwort's Warren p. 21";
  return (
    <Panel title="Saving throw" aside={source}>
      {c.classes.length === 0 ? (
        <div className="font-mono text-4xl">?</div>
      ) : (
        // Elves keep a separate saving throw for each class (WW p. 21).
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {c.classes.map((k) => (
            <span key={k.id} className="flex items-baseline gap-2">
              <span className="font-mono text-4xl">{cappedLevelFor(c.race, k.class, k.xp).save}</span>
              {c.classes.length > 1 && <span className="text-sm text-muted">{CLASS_NAMES[k.class]}</span>}
            </span>
          ))}
        </div>
      )}
      {bonuses.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-sm">
          {bonuses.map((b, i) => (
            <li key={i}>
              <span className="font-mono">{formatModifier(b.bonus)}</span> vs {againstText(b.against)}{" "}
              <span className="text-xs text-subtle">({b.who})</span>
            </li>
          ))}
        </ul>
      )}
      {overlap.length > 0 && (
        <p className="text-xs text-amber">
          Class and race both give a bonus vs {againstText(overlap)}. Whether they add together waits on Jay (save-bonus-stacking).
        </p>
      )}
      <p className="text-xs text-subtle">
        One number for every saving throw (WW p. 21). Wisdom vs charms and illusions is the referee&apos;s call (wis-vs-mind).
      </p>
    </Panel>
  );
}

/** Carried units and the movement band (WW pp. 16, 47). */
export function EncumbrancePanel({ items }: { items: CharacterSheet["items"] }) {
  const units = carriedUnits(items);
  const band = bandFor(units);
  const unknown = unknownUnitItems(items);
  return (
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
      <p className="text-xs text-subtle">Magic gear counts 0 (campaign ruling).</p>
      {unknown > 0 && (
        <p className="text-xs text-amber">
          {unknown} item{unknown === 1 ? "" : "s"} with no weight entered, so the total is a floor. Weights are on Woundwort&apos;s Warren p. 18.
        </p>
      )}
    </Panel>
  );
}

/** Every roll made for this character, kept forever, including ones a re-roll replaced. */
export function RollsPanel({ c, imported }: { c: CharacterSheet; imported: boolean }) {
  const current = new Set([c.abilityRollId, c.hpRollId, c.goldRollId]);
  return (
    <Panel
      title={`Rolls · ${c.rolls.length}`}
      aside={
        <>
          Never changed or deleted.{" "}
          <Link href="/rolls" className="text-moon underline-offset-4 hover:underline">
            Roll log
          </Link>
        </>
      }
    >
      {c.rolls.length === 0 ? (
        <p className="text-sm text-muted">
          {imported ? "No rolls recorded for this character (imported from a sheet)." : "No rolls recorded for this character yet."}
        </p>
      ) : (
        <ul className={`flex flex-col ${divider}`}>
          {c.rolls.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <span className="text-sm">
                {PURPOSE_LABEL[r.purpose] ?? r.purpose} <span className="text-subtle">by {r.rollerName ?? "someone"}</span>
                {!current.has(r.id) && <span className="ml-2 text-xs text-amber">replaced by a granted re-roll</span>}
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
  );
}

/** Sheets uploaded for an import, kept for Jay. Only the player and staff get this list. */
export function UploadedSheetsPanel({ sheets }: { sheets: Awaited<ReturnType<typeof sheetsForCharacter>> }) {
  return (
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
  );
}

/** Conflicts found when a sheet was imported (importFlags), left for Jay to settle. */
export function ImportFlagsPanel({ flags }: { flags: CharacterSheet["importFlags"] }) {
  return (
    <Panel title={`Import flags for Jay · ${flags.length}`} className="border-[#5e4720]">
      <ul className={`flex flex-col ${divider}`}>
        {flags.map((f) => (
          <li key={f.title} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
            <span className="font-semibold">{f.title}</span>
            <span className="text-sm text-muted">{f.body}</span>
            <span className="font-mono text-xs text-subtle">{f.source}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
