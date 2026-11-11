"use client";

import { startTransition, useActionState, useState, type FormEvent, type ReactNode } from "react";
import { Panel } from "@/components/ui";
import { COIN_MAX, GP_MIN, HP_LIMIT, HP_MIN } from "@/lib/rules/overrides";
import { changeHitPoints, setCoins, type StatResult } from "../stat-actions";

const idle: StatResult = { error: null, at: 0 };
const inputCls =
  "min-h-11 w-full min-w-0 rounded-xl border border-line-2 bg-ink px-3 font-mono text-[15px] text-parchment";
const editBtn = "min-h-9 rounded-lg border border-line-2 px-3 text-[13px] font-semibold text-[#d6d2c2] hover:border-lime";

function Problem({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-lg border border-[#5c3328] bg-[#2e1a15] px-3 py-2 text-sm text-ember">
      {text}
    </p>
  );
}

/** Closes the editor after a save that worked; keeps it open after a problem. */
function useCloseOnSuccess(state: StatResult, close: () => void) {
  const [seenAt, setSeenAt] = useState(0);
  if (state.at !== seenAt) {
    setSeenAt(state.at);
    if (!state.error) close();
  }
}

/** Submits through a transition, keeping the clicked button's name and value. */
const submitWith = (action: (fd: FormData) => void) => (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const submitter = (e.nativeEvent as SubmitEvent).submitter;
  const fd = new FormData(e.currentTarget, submitter instanceof HTMLButtonElement ? submitter : null);
  startTransition(() => action(fd));
};

/**
 * Hit points on the sheet. The player tracks damage and healing on an
 * approved character; Jay and admins on submitted ones too.
 */
export function HitPointsPanel({
  id,
  current,
  max,
  canEdit,
  staff,
  handSet,
}: {
  id: string;
  current: number | null;
  max: number | null;
  canEdit: boolean;
  staff: boolean;
  /** A line saying who set maximum hit points by hand, if anyone did. */
  handSet: ReactNode;
}) {
  const [state, action, pending] = useActionState(changeHitPoints, idle);
  const [editing, setEditing] = useState(false);
  useCloseOnSuccess(state, () => setEditing(false));
  const editable = canEdit && max !== null && current !== null;

  return (
    <Panel
      title="Hit points"
      aside={
        editable &&
        !editing && (
          <button type="button" onClick={() => setEditing(true)} className={editBtn}>
            Change
          </button>
        )
      }
    >
      {max === null || current === null ? (
        <div className="text-sm text-subtle">Not rolled yet</div>
      ) : (
        <div className={`font-mono text-4xl ${current <= 0 ? "text-ember" : ""}`}>
          {current}
          <span className="text-lg text-subtle"> / {max}</span>
        </div>
      )}
      {current !== null && max !== null && current > max && <div className="text-xs text-amber">Above the maximum.</div>}
      {current !== null && current <= 0 && (
        <div className="text-xs text-subtle">What 0 or less means waits on Jay&apos;s ruling (hp-below-zero).</div>
      )}
      {handSet}
      {editing && (
        <form onSubmit={submitWith(action)} className="flex flex-col gap-2 border-t border-[#262920] pt-3">
          <input type="hidden" name="id" value={id} />
          <label htmlFor={`hp-amount-${id}`} className="text-[13px] text-muted">
            Hit points
          </label>
          <input
            id={`hp-amount-${id}`}
            name="amount"
            type="number"
            inputMode="numeric"
            required
            step={1}
            min={HP_MIN}
            max={HP_LIMIT}
            autoFocus
            className={inputCls}
          />
          <div className="grid grid-cols-3 gap-2">
            <button type="submit" name="mode" value="damage" disabled={pending} className="min-h-11 rounded-xl border border-[#5c3328] text-sm font-semibold text-ember hover:bg-[#2e1a15] disabled:opacity-60">
              Damage
            </button>
            <button type="submit" name="mode" value="heal" disabled={pending} className="min-h-11 rounded-xl bg-lime text-sm font-semibold text-lime-ink hover:brightness-110 disabled:opacity-60">
              Heal
            </button>
            <button type="submit" name="mode" value="set" disabled={pending} className="min-h-11 rounded-xl border border-line-2 text-sm font-semibold text-[#d6d2c2] hover:border-lime disabled:opacity-60">
              Set to
            </button>
          </div>
          <p className="text-xs text-subtle">
            Healing stops at the maximum.{staff ? " Jay and admins can set current hit points above it." : ""}
          </p>
          <Problem text={state.error} />
          <button type="button" onClick={() => setEditing(false)} className="self-start text-sm text-muted underline-offset-4 hover:underline">
            Done
          </button>
        </form>
      )}
    </Panel>
  );
}

/** Coins on the sheet: the player on an approved character; Jay and admins on submitted ones too. */
export function CoinsPanel({ id, gp, sp, cp, canEdit }: { id: string; gp: number; sp: number; cp: number; canEdit: boolean }) {
  const [state, action, pending] = useActionState(setCoins, idle);
  const [editing, setEditing] = useState(false);
  useCloseOnSuccess(state, () => setEditing(false));

  const coins = [
    { key: "gp", label: "gold", value: gp, min: GP_MIN },
    { key: "sp", label: "silver", value: sp, min: 0 },
    { key: "cp", label: "copper", value: cp, min: 0 },
  ] as const;

  return (
    <Panel
      title="Coins"
      aside={
        canEdit &&
        !editing && (
          <button type="button" onClick={() => setEditing(true)} className={editBtn}>
            Change
          </button>
        )
      }
    >
      {editing ? (
        <form onSubmit={submitWith(action)} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={id} />
          <div className="grid grid-cols-3 gap-2">
            {coins.map((c) => (
              <label key={c.key} className="flex flex-col gap-1.5 text-center text-xs text-muted">
                <input
                  name={c.key}
                  type="number"
                  inputMode="numeric"
                  required
                  step={1}
                  min={c.min}
                  max={COIN_MAX}
                  defaultValue={c.value}
                  className={`${inputCls} text-center`}
                />
                {c.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-subtle">Gold can go below 0 for a debt. Silver and copper can&apos;t.</p>
          <Problem text={state.error} />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={pending} onClick={() => setEditing(false)} className="min-h-11 rounded-xl border border-line-2 px-4 text-sm text-[#d6d2c2] hover:border-lime disabled:opacity-60">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-lime px-4 text-sm font-semibold text-lime-ink hover:brightness-110 disabled:opacity-60">
              {pending ? "Saving…" : "Save coins"}
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center">
          {coins.map((c) => (
            <div key={c.key} className={`rounded-lg p-2 ${c.value < 0 ? "bg-[#2e1a15] text-ember" : "bg-surface-2"}`}>
              <div className="font-mono text-xl">{c.value}</div>
              <div className="text-xs text-muted">{c.label}</div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
