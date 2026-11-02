"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { Alignment, CharacterClass, Race } from "@/db/schema";
import { GAZETTEER_PATRONS, pick, randomName, shuffledIndexes } from "@/lib/rules/names";

type Ability = "str" | "int" | "wis" | "dex" | "con" | "cha";
const ABILITY_ORDER: { key: Ability; name: string }[] = [
  { key: "str", name: "Strength" },
  { key: "int", name: "Intelligence" },
  { key: "wis", name: "Wisdom" },
  { key: "dex", name: "Dexterity" },
  { key: "con", name: "Constitution" },
  { key: "cha", name: "Charisma" },
];

/** A small die button. Random picks only fill the form; nothing is saved or logged until you press Save. */
export function RandomButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="inline-flex size-11 flex-none items-center justify-center rounded-xl border border-line-2 text-muted hover:border-lime hover:text-lime disabled:opacity-40"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
        <circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
}

export function SubmitButton({
  children,
  pendingText,
  tone = "lime",
}: {
  children: React.ReactNode;
  pendingText: string;
  tone?: "lime" | "plain" | "ember" | "amber";
}) {
  const { pending } = useFormStatus();
  const cls = {
    lime: "bg-lime text-lime-ink hover:brightness-110",
    amber: "bg-amber text-[#1a1408] hover:brightness-110",
    plain: "border border-line-2 text-[#d6d2c2] hover:border-lime",
    ember: "border border-[#5c3328] text-ember hover:bg-[#2e1a15]",
  }[tone];
  return (
    <button
      type="submit"
      disabled={pending}
      className={`min-h-11 rounded-xl px-4 text-sm font-semibold disabled:opacity-60 ${cls}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}

/** Arrange the six rolled sets: each set goes to one ability (WW p. 5). */
export function AbilityAssign({
  id,
  totals,
  initial,
  action,
}: {
  id: string;
  totals: number[];
  initial: Partial<Record<Ability, number>>;
  action: (fd: FormData) => Promise<void>;
}) {
  const [picks, setPicks] = useState<Record<Ability, string>>(
    () =>
      Object.fromEntries(
        ABILITY_ORDER.map(({ key }) => [key, initial[key] === undefined ? "" : String(initial[key])]),
      ) as Record<Ability, string>,
  );
  const used = new Set(Object.values(picks).filter((v) => v !== ""));
  const complete = used.size === 6;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
        {ABILITY_ORDER.map(({ key, name }) => (
          <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2">
            <span className="text-sm font-semibold tracking-wide">{name}</span>
            <select
              name={key}
              required
              value={picks[key]}
              onChange={(e) => setPicks((p) => ({ ...p, [key]: e.target.value }))}
              className="min-h-10 rounded-lg border border-line-2 bg-ink px-2 font-mono text-[15px]"
            >
              <option value="" disabled>
                Pick
              </option>
              {totals.map((t, i) => (
                <option key={i} value={i} disabled={used.has(String(i)) && picks[key] !== String(i)}>
                  {t} (set {i + 1})
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <RandomButton
          label="Arrange the sets at random"
          onClick={() => {
            const order = shuffledIndexes(6);
            setPicks(Object.fromEntries(ABILITY_ORDER.map(({ key }, i) => [key, String(order[i])])) as Record<Ability, string>);
          }}
        />
        {complete ? (
          <SubmitButton pendingText="Saving…">Save abilities</SubmitButton>
        ) : (
          <span className="text-sm text-subtle">Give every ability one set to save, or arrange them at random.</span>
        )}
      </div>
    </form>
  );
}

const CLASS_LABEL: Record<CharacterClass, string> = {
  "fighting-man": "Fighting-Man",
  "magic-user": "Magic-User",
  cleric: "Cleric",
  thief: "Thief",
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function IdentityForm({
  id,
  action,
  initial,
  raceClasses,
  locked,
}: {
  id: string;
  action: (fd: FormData) => Promise<void>;
  initial: { name: string; race: Race | null; cls: CharacterClass | null; alignment: Alignment | null; deity: string | null };
  raceClasses: Record<Race, CharacterClass[]>;
  locked: boolean;
}) {
  const [name, setName] = useState(initial.name === "Unnamed adventurer" ? "" : initial.name);
  const [race, setRace] = useState<Race | "">(initial.race ?? "");
  const [cls, setCls] = useState<CharacterClass | "">(initial.cls ?? "");
  const [alignment, setAlignment] = useState<Alignment | "">(initial.alignment ?? "");
  const [deity, setDeity] = useState(initial.deity ?? "");
  const races = Object.keys(raceClasses) as Race[];
  const classes = race ? raceClasses[race] : [];
  const alignmentsFor = (k: CharacterClass | ""): Alignment[] =>
    k === "thief" ? ["neutral", "chaotic"] : ["lawful", "neutral", "chaotic"];
  const alignments = alignmentsFor(cls);
  const field = "min-h-11 min-w-0 flex-1 rounded-xl border border-line-2 bg-ink px-3 text-[15px] text-parchment disabled:opacity-60";

  // Every random pick respects the rules for what's already chosen:
  // race fits the class (WW pp. 9-10), class fits the race, alignment fits the class (WW p. 9).
  const chooseClass = (r: Race | "", k: CharacterClass | "") => {
    setCls(k);
    if (k && alignment && !alignmentsFor(k).includes(alignment)) setAlignment("");
    if (r && k && !raceClasses[r].includes(k)) setCls("");
  };
  const randomRace = () => {
    const fitting = cls ? races.filter((r) => raceClasses[r].includes(cls)) : races;
    const r = pick(fitting);
    setRace(r);
    if (cls && !raceClasses[r].includes(cls)) setCls("");
    return r;
  };
  const randomClass = (r: Race | "" = race) => {
    if (!r) return "" as const;
    const k = pick(raceClasses[r]);
    chooseClass(r, k);
    return k;
  };
  const randomAlignment = (k: CharacterClass | "" = cls) => setAlignment(pick(alignmentsFor(k)));
  const randomAll = () => {
    setName(randomName());
    const r = pick(races);
    setRace(r);
    const k = pick(raceClasses[r]);
    setCls(k);
    const al = pick(alignmentsFor(k));
    setAlignment(al);
    setDeity(al === "chaotic" ? "" : pick(GAZETTEER_PATRONS));
  };

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">
          Name
          <span className="flex gap-2">
            <input name="name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className={field} />
            <RandomButton label="Random name from Gazetteer words" onClick={() => setName(randomName())} />
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">
          Race
          {locked && <input type="hidden" name="race" value={race} />}
          <span className="flex gap-2">
            <select
              name={locked ? undefined : "race"}
              required
              disabled={locked}
              value={race}
              onChange={(e) => {
                const r = e.target.value as Race;
                setRace(r);
                if (cls && !raceClasses[r].includes(cls)) setCls("");
              }}
              className={field}
            >
              <option value="" disabled>
                Choose
              </option>
              {races.map((r) => (
                <option key={r} value={r}>
                  {cap(r)}
                </option>
              ))}
            </select>
            <RandomButton label={cls ? `Random race that can be a ${CLASS_LABEL[cls]}` : "Random race"} onClick={randomRace} disabled={locked} />
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">
          Class
          {locked && <input type="hidden" name="cls" value={cls} />}
          <span className="flex gap-2">
            <select
              name={locked ? undefined : "cls"}
              required
              disabled={locked || !race}
              value={cls}
              onChange={(e) => chooseClass(race, e.target.value as CharacterClass)}
              className={field}
            >
              <option value="" disabled>
                {race ? "Choose" : "Pick a race first"}
              </option>
              {classes.map((k) => (
                <option key={k} value={k}>
                  {CLASS_LABEL[k]}
                </option>
              ))}
            </select>
            <RandomButton label="Random class this race may take" onClick={() => randomClass()} disabled={locked || !race} />
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">
          Alignment
          <span className="flex gap-2">
            <select name="alignment" required value={alignment} onChange={(e) => setAlignment(e.target.value as Alignment)} className={field}>
              <option value="" disabled>
                Choose
              </option>
              {alignments.map((a) => (
                <option key={a} value={a}>
                  {cap(a)}
                </option>
              ))}
            </select>
            <RandomButton label="Random alignment this class allows" onClick={() => randomAlignment()} />
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">
          Patron (optional)
          <span className="flex gap-2">
            <input name="deity" maxLength={60} value={deity} onChange={(e) => setDeity(e.target.value)} className={field} />
            <RandomButton
              label={alignment === "chaotic" ? "The Gazetteer's gods serve Law; chaotic patrons are demons, so choose with Jay" : "Random patron from the Gazetteer's gods"}
              onClick={() => setDeity(pick(GAZETTEER_PATRONS))}
              disabled={alignment === "chaotic"}
            />
          </span>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {!locked && (
          <button
            type="button"
            onClick={randomAll}
            className="min-h-11 rounded-xl border border-line-2 px-4 text-sm font-semibold text-[#d6d2c2] hover:border-lime"
          >
            Randomize all
          </button>
        )}
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
        <span className="text-xs text-subtle">Random picks only fill the form. Nothing is saved until you press Save.</span>
      </div>
    </form>
  );
}
