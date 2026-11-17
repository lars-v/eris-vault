"use client";

import { startTransition, useActionState, useOptimistic, useState, type FormEvent, type ReactNode } from "react";
import { Panel } from "@/components/ui";
import { applyHpChange, COIN_MAX, GP_MIN, HP_LIMIT, HP_MIN, type HpChange } from "@/lib/rules/overrides";
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


/** The value before and after the latest change, so a slip can be undone. */
type LastChange = { from: number; to: number };

const quickBtn =
  "min-h-11 min-w-11 rounded-xl border px-3 font-mono text-base font-semibold disabled:opacity-40";

/** How full the bar is and its color: lime above half, amber above 0, ember at 0 or less. */
function HpBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const color = current <= 0 ? "bg-ember" : current * 2 > max ? "bg-lime" : "bg-amber";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
      <div className={`h-full rounded-full transition-[width] duration-300 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * Hit points on the sheet. The player tracks damage and healing on an
 * approved character; Jay and admins on submitted ones too. The number moves
 * as soon as a button is pressed; the server checks every change.
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
  const [state, action] = useActionState(changeHitPoints, idle);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState("");
  const [last, setLast] = useState<LastChange | null>(null);
  const [seenAt, setSeenAt] = useState(0);
  const [shown, addOptimistic] = useOptimistic(current, (cur: number | null, next: number) => (cur === null ? cur : next));

  // A refused change drops the undo line; a change that worked closes the editor.
  if (state.at !== seenAt) {
    setSeenAt(state.at);
    if (state.error) setLast(null);
    else {
      setEditing(false);
      setAmount("");
    }
  }

  if (max === null || current === null || shown === null) {
    return (
      <Panel title="Hit points">
        <div className="text-sm text-subtle">Not rolled yet</div>
        {handSet}
      </Panel>
    );
  }


  const now = shown;
  const preview = (change: HpChange) => applyHpChange({ current: now, max }, change, staff);

  function send(change: HpChange) {
    const next = preview(change);
    if (typeof next === "number") {
      if (next === now) return;
      setLast((l) => (l && l.to === now ? { from: l.from, to: next } : { from: now, to: next }));
    }
    const fd = new FormData();
    fd.set("id", id);
    fd.set("mode", change.mode);
    fd.set("amount", String(change.amount));
    startTransition(() => {
      if (typeof next === "number") addOptimistic(next);
      action(fd);
    });
  }

  const typed = amount.trim() === "" ? NaN : Number(amount);
  const label = (mode: HpChange["mode"], word: string) => {
    if (Number.isNaN(typed)) return word;
    const next = preview({ mode, amount: typed });
    return typeof next === "number" ? `${word} → ${next}` : word;
  };
  const healNoop = shown >= max;

  return (
    <Panel
      title="Hit points"
      aside={
        canEdit &&
        !editing && (
          <button type="button" onClick={() => setEditing(true)} className={editBtn}>
            Change
          </button>
        )
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={`font-mono text-4xl ${shown <= 0 ? "text-ember" : ""}`} aria-live="polite">
          {shown}
          <span className="text-lg text-subtle"> / {max}</span>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => send({ mode: "damage", amount: 1 })}
              disabled={shown <= HP_MIN}
              aria-label="Take 1 damage"
              title="Take 1 damage"
              className={`${quickBtn} border-[#5c3328] text-ember hover:bg-[#2e1a15]`}
            >
              −1
            </button>
            <button
              type="button"
              onClick={() => send({ mode: "heal", amount: 1 })}
              disabled={healNoop}
              aria-label="Heal 1"
              title="Heal 1"
              className={`${quickBtn} border-line-2 text-lime hover:border-lime`}
            >
              +1
            </button>
          </div>
        )}
      </div>
      <HpBar current={shown} max={max} />
      {shown > max && <div className="text-xs text-amber">Above the maximum.</div>}
      {shown <= 0 && (
        <div className="text-xs text-subtle">What 0 or less means waits on Jay&apos;s ruling (hp-below-zero).</div>
      )}
      {canEdit && last && last.from !== last.to && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>
            {last.to < last.from ? `Took ${last.from - last.to} damage` : `Healed ${last.to - last.from}`}: {last.from} → {last.to}.
          </span>
          <button
            type="button"
            onClick={() => send({ mode: "set", amount: last.from })}
            className="font-semibold text-parchment underline underline-offset-4 hover:text-lime"
          >
            Undo
          </button>
        </div>
      )}
      {handSet}
      {!editing && <Problem text={state.error} />}
      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const submitter = (e.nativeEvent as SubmitEvent).submitter;
            const mode = (submitter instanceof HTMLButtonElement ? submitter.value : "damage") as HpChange["mode"];
            send({ mode, amount: typed });
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
          }}
          className="flex flex-col gap-2 border-t border-[#262920] pt-3"
        >
          <label htmlFor={`hp-amount-${id}`} className="text-[13px] text-muted">
            How many hit points?
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
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputCls}
          />
          <div className="grid grid-cols-3 gap-2">
            <button type="submit" value="damage" className="min-h-11 rounded-xl border border-[#5c3328] px-1 text-sm font-semibold text-ember hover:bg-[#2e1a15]">
              {label("damage", "Damage")}
            </button>
            <button type="submit" value="heal" disabled={healNoop} className="min-h-11 rounded-xl bg-lime px-1 text-sm font-semibold text-lime-ink hover:brightness-110 disabled:opacity-40">
              {label("heal", "Heal")}
            </button>
            <button type="submit" value="set" className="min-h-11 rounded-xl border border-line-2 px-1 text-sm font-semibold text-[#d6d2c2] hover:border-lime">
              {Number.isNaN(typed) ? "Set to" : `Set to ${typed}`}
            </button>
          </div>
          {!healNoop && (
            <button
              type="button"
              onClick={() => send({ mode: "heal", amount: max - shown })}
              className="min-h-11 rounded-xl border border-line-2 text-sm font-semibold text-lime hover:border-lime"
            >
              Heal to full ({max})
            </button>
          )}
          <p className="text-xs text-subtle">
            Enter takes damage. Healing stops at the maximum.{staff ? " Jay and admins can set current hit points above it." : ""}
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
