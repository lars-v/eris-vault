"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { Alignment, CharacterClass, Race } from "@/db/schema";

type Ability = "str" | "int" | "wis" | "dex" | "con" | "cha";
const ABILITY_ORDER: { key: Ability; name: string }[] = [
  { key: "str", name: "Strength" },
  { key: "int", name: "Intelligence" },
  { key: "wis", name: "Wisdom" },
  { key: "dex", name: "Dexterity" },
  { key: "con", name: "Constitution" },
  { key: "cha", name: "Charisma" },
];

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
      <div>
        {complete ? (
          <SubmitButton pendingText="Saving…">Save abilities</SubmitButton>
        ) : (
          <span className="text-sm text-subtle">Give every ability one set to save.</span>
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
  const [race, setRace] = useState<Race | "">(initial.race ?? "");
  const [cls, setCls] = useState<CharacterClass | "">(initial.cls ?? "");
  const [alignment, setAlignment] = useState<Alignment | "">(initial.alignment ?? "");
  const classes = race ? raceClasses[race] : [];
  const alignments: Alignment[] = cls === "thief" ? ["neutral", "chaotic"] : ["lawful", "neutral", "chaotic"];
  const field = "min-h-11 rounded-xl border border-line-2 bg-ink px-3 text-[15px] text-parchment disabled:opacity-60";

  return (
    <form action={action} className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1.5 text-[13px] text-muted">
        Name
        <input name="name" required maxLength={60} defaultValue={initial.name === "Unnamed adventurer" ? "" : initial.name} className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-muted">
        Race
        {locked && <input type="hidden" name="race" value={race} />}
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
          {(Object.keys(raceClasses) as Race[]).map((r) => (
            <option key={r} value={r}>
              {cap(r)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-muted">
        Class
        {locked && <input type="hidden" name="cls" value={cls} />}
        <select
          name={locked ? undefined : "cls"}
          required
          disabled={locked || !race}
          value={cls}
          onChange={(e) => {
            const k = e.target.value as CharacterClass;
            setCls(k);
            if (k === "thief" && alignment === "lawful") setAlignment("");
          }}
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
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-muted">
        Alignment
        <select
          name="alignment"
          required
          value={alignment}
          onChange={(e) => setAlignment(e.target.value as Alignment)}
          className={field}
        >
          <option value="" disabled>
            Choose
          </option>
          {alignments.map((a) => (
            <option key={a} value={a}>
              {cap(a)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-muted">
        Patron (optional)
        <input name="deity" maxLength={60} defaultValue={initial.deity ?? ""} className={field} />
      </label>
      <div className="flex items-end">
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </div>
    </form>
  );
}
