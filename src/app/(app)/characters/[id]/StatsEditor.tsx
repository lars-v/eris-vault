"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import type { CharacterClass } from "@/db/schema";
import { ABILITIES, ABILITY_NAMES, type Ability } from "@/lib/rules/abilities";
import { CLASS_NAMES } from "@/lib/rules/advancement";
import { alignmentsFor, ALIGNMENTS } from "@/lib/rules/creation";
import { ABILITY_MAX, ABILITY_MIN, DEITY_MAX, HP_LIMIT, NAME_MAX, REASON_MAX, XP_LIMIT } from "@/lib/rules/overrides";
import { overrideStats, type StatResult } from "../stat-actions";

export type StatsEditorClass = { id: string; class: CharacterClass; xp: number; highestHitDie: number };

type Values = Record<Ability, string> & { name: string; alignment: string; deity: string; hpMax: string; xp: Record<string, string> };

const idle: StatResult = { error: null, at: 0 };
const field = "min-h-11 w-full min-w-0 rounded-xl border border-line-2 bg-ink px-3 text-[15px] text-parchment";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Jay and admins set abilities, maximum hit points, XP, name, alignment and
 * patron by hand (can.overrideStats). A reason is required; the change goes
 * in the audit log, the rolls stay in the roll log, and the sheet marks
 * hand-set abilities and maximum hit points.
 */
export function StatsEditor({
  id,
  name,
  alignment,
  deity,
  scores,
  hpMax,
  classes,
  activeClass,
}: {
  id: string;
  name: string;
  alignment: string | null;
  deity: string | null;
  scores: Record<Ability, number | null>;
  hpMax: number | null;
  classes: StatsEditorClass[];
  activeClass: CharacterClass | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(overrideStats, idle);

  const start = (): Values => ({
    ...(Object.fromEntries(ABILITIES.map((a) => [a, scores[a] === null ? "" : String(scores[a])])) as Record<Ability, string>),
    name,
    alignment: alignment ?? "",
    deity: deity ?? "",
    hpMax: hpMax === null ? "" : String(hpMax),
    xp: Object.fromEntries(classes.map((k) => [k.id, String(k.xp)])),
  });
  const [initial, setInitial] = useState<Values>(start);
  const [values, setValues] = useState<Values>(start);
  const [reason, setReason] = useState("");

  // Close after a save that worked; stay open with the problem shown otherwise.
  useEffect(() => {
    if (state.at && !state.error) dialog.current?.close();
  }, [state]);

  const open = () => {
    const v = start();
    setInitial(v);
    setValues(v);
    setReason("");
    dialog.current?.showModal();
  };

  const changed: string[] = [];
  if (values.name.trim() !== initial.name) changed.push("Name");
  if (values.alignment !== initial.alignment) changed.push("Alignment");
  if (values.deity.trim() !== initial.deity) changed.push("Patron");
  for (const a of ABILITIES) if (values[a] !== initial[a]) changed.push(ABILITY_NAMES[a]);
  if (values.hpMax !== initial.hpMax) changed.push("Maximum hit points");
  for (const k of classes) if (values.xp[k.id] !== initial.xp[k.id]) changed.push(`XP (${CLASS_NAMES[k.class]})`);
  const conChanged = values.con !== initial.con;

  const allowed = activeClass ? alignmentsFor(activeClass) : ALIGNMENTS;
  const set = (k: keyof Omit<Values, "xp">) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex min-h-11 items-center rounded-xl border border-line-2 px-4 text-sm font-semibold text-[#d6d2c2] hover:border-lime"
      >
        Set stats by hand
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`stats-title-${id}`}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-surface text-parchment backdrop:bg-black/70 sm:m-auto sm:h-auto sm:max-h-[90dvh] sm:max-w-160 sm:rounded-2xl sm:border sm:border-line"
      >
        <form onSubmit={submit} className="flex h-full flex-col">
          <input type="hidden" name="id" value={id} />
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 id={`stats-title-${id}`} className="font-display text-2xl text-parchment-2">
              Set stats by hand
            </h2>
            <button type="button" onClick={() => dialog.current?.close()} className="min-h-11 rounded-xl px-3 text-sm text-muted hover:text-parchment">
              Close
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
            <p className="text-sm text-muted">
              For fixing mistakes and things that happen in play. The rolls stay in the roll log. Hand-set abilities and maximum hit
              points are marked on the sheet. Race and class can&apos;t change here.
            </p>

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-sm font-semibold">Identity</legend>
              <label className="flex flex-col gap-1.5 text-[13px] text-muted">
                Name
                <input name="name" required maxLength={NAME_MAX} value={values.name} onChange={set("name")} className={field} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-[13px] text-muted">
                  Alignment
                  <select name="alignment" required value={values.alignment} onChange={set("alignment")} className={field}>
                    {values.alignment === "" && <option value="">Choose</option>}
                    {ALIGNMENTS.map((a) => (
                      <option key={a} value={a} disabled={!allowed.includes(a)}>
                        {cap(a)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] text-muted">
                  Patron (optional)
                  <input name="deity" maxLength={DEITY_MAX} value={values.deity} onChange={set("deity")} className={field} />
                </label>
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-semibold">
                Abilities <span className="font-normal text-subtle">· {ABILITY_MIN} to {ABILITY_MAX}, WW p. 5</span>
              </legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ABILITIES.map((a) => (
                  <label key={a} className="flex flex-col gap-1.5 text-[13px] text-muted">
                    {ABILITY_NAMES[a]}
                    <input
                      name={a}
                      type="number"
                      inputMode="numeric"
                      required
                      step={1}
                      min={ABILITY_MIN}
                      max={ABILITY_MAX}
                      value={values[a]}
                      onChange={set(a)}
                      className={`${field} font-mono`}
                    />
                  </label>
                ))}
              </div>
              {conChanged && (
                <p className="text-xs text-amber">
                  Maximum hit points don&apos;t follow a new Constitution on their own. Jay rules on that (con-change-hp). Change them
                  below if needed.
                </p>
              )}
            </fieldset>

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-sm font-semibold">Hit points and experience</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-[13px] text-muted">
                  Maximum hit points
                  <input
                    name="hpMax"
                    type="number"
                    inputMode="numeric"
                    required
                    step={1}
                    min={1}
                    max={HP_LIMIT}
                    value={values.hpMax}
                    onChange={set("hpMax")}
                    className={`${field} font-mono`}
                  />
                </label>
                {classes.map((k) => (
                  <label key={k.id} className="flex flex-col gap-1.5 text-[13px] text-muted">
                    XP{classes.length > 1 ? ` (${CLASS_NAMES[k.class]})` : ""}
                    <input
                      name={`xp-${k.id}`}
                      type="number"
                      inputMode="numeric"
                      required
                      step={1}
                      min={0}
                      max={XP_LIMIT}
                      value={values.xp[k.id] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, xp: { ...v.xp, [k.id]: e.target.value } }))}
                      className={`${field} font-mono`}
                    />
                    {k.highestHitDie > 1 && (
                      <span className="text-xs text-subtle">Hit points are rolled up to level {k.highestHitDie}, so XP can&apos;t drop below it.</span>
                    )}
                  </label>
                ))}
              </div>
              <p className="text-xs text-subtle">
                Current hit points and coins are changed on the sheet itself. To add XP for an adventure, use Award XP.
              </p>
            </fieldset>

            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Reason
              <input
                name="reason"
                required
                maxLength={REASON_MAX}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="What happened"
                className={`${field} font-normal`}
              />
              <span className="text-xs font-normal text-subtle">Goes in the audit log. The player sees it on the sheet.</span>
            </label>

            {state.error && (
              <p role="alert" className="rounded-lg border border-[#5c3328] bg-[#2e1a15] px-3 py-2 text-sm text-ember">
                {state.error}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
            <span className="text-sm text-muted">{changed.length === 0 ? "Nothing changed yet." : `Changing: ${changed.join(", ")}`}</span>
            <button
              type="submit"
              disabled={pending || changed.length === 0 || !reason.trim()}
              className="min-h-11 rounded-xl bg-amber px-4 text-sm font-semibold text-[#1a1408] hover:brightness-110 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
