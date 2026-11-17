"use client";

import { useActionState, useState } from "react";
import { STAFF_NOTE_MAX } from "@/lib/rules/staff";
import { loadStoredSpell, releaseStoredSpell, setSpellFocus, voidStoredSpell, type StaffResult } from "../staff-actions";

const idle: StaffResult = { error: null, at: 0 };

export type StaffSlotView = {
  slot: number;
  /** Spell name while loaded, null when empty. */
  spellName: string | null;
  /** False when the slot is past what Intelligence allows (WW p. 7). */
  usable: boolean;
};

const selectCls = "min-h-11 w-full min-w-0 rounded-xl border border-line-2 bg-ink px-2 text-sm";
const plainBtn = "min-h-11 rounded-xl border border-line-2 px-4 text-sm text-[#d6d2c2] hover:border-lime disabled:opacity-60";
const limeBtn = "min-h-11 rounded-xl bg-lime px-4 text-sm font-semibold text-lime-ink hover:brightness-110 disabled:opacity-60";
const emberBtn = "min-h-11 rounded-xl border border-[#5c3328] px-4 text-sm font-semibold text-ember hover:bg-[#2e1a15] disabled:opacity-60";
const smallBtn = "min-h-9 rounded-lg border border-line-2 px-3 text-[13px] font-semibold text-[#d6d2c2] hover:border-lime";

function Problem({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-lg border border-[#5c3328] bg-[#2e1a15] px-3 py-2 text-sm text-ember">
      {text}
    </p>
  );
}

/** Closes an open form once its action comes back without a problem. */
function useCloseOnSuccess(state: StaffResult, close: () => void) {
  const [seenAt, setSeenAt] = useState(0);
  if (state.at !== seenAt) {
    setSeenAt(state.at);
    if (!state.error) close();
  }
}

type Mode = "idle" | "load" | "release" | "void";

/** One slot of the staff: the token, and Load, Release or Void for those allowed. */
function Slot({
  id,
  slot,
  spells,
  canUse,
  canVoid,
  hasFocus,
}: {
  id: string;
  slot: StaffSlotView;
  spells: { key: string; name: string }[];
  canUse: boolean;
  canVoid: boolean;
  hasFocus: boolean;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const close = () => setMode("idle");
  const [loadState, loadAction, loading] = useActionState(loadStoredSpell, idle);
  const [releaseState, releaseAction, releasing] = useActionState(releaseStoredSpell, idle);
  const [voidState, voidAction, voiding] = useActionState(voidStoredSpell, idle);
  useCloseOnSuccess(loadState, close);
  useCloseOnSuccess(releaseState, close);
  useCloseOnSuccess(voidState, close);
  const loaded = slot.spellName !== null;

  return (
    <li data-testid={`staff-slot-${slot.slot}`} className="flex flex-col gap-2 rounded-xl border border-line-2 bg-surface-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Slot {slot.slot}</span>
          {loaded ? (
            <span className="text-[15px] font-semibold text-lime">{slot.spellName}</span>
          ) : (
            <span className="text-[15px] text-muted">Empty: recast to load</span>
          )}
          {!slot.usable && <span className="text-xs text-amber">Past what Intelligence allows now</span>}
        </span>
        {mode === "idle" && (
          <span className="flex flex-wrap gap-2">
            {canUse && !loaded && slot.usable && hasFocus && (
              <button type="button" onClick={() => setMode("load")} className={smallBtn}>
                Load
              </button>
            )}
            {canUse && loaded && (
              <button type="button" onClick={() => setMode("release")} className={smallBtn}>
                Release
              </button>
            )}
            {canVoid && loaded && (
              <button type="button" onClick={() => setMode("void")} className="min-h-9 rounded-lg border border-[#5c3328] px-3 text-[13px] font-semibold text-ember hover:bg-[#2e1a15]">
                Void
              </button>
            )}
          </span>
        )}
      </div>

      {mode === "load" && (
        <form action={loadAction} className="flex flex-col gap-2 border-t border-[#262920] pt-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="slot" value={slot.slot} />
          <p className="text-sm text-muted">
            Loading uses one of the day&apos;s castings: the spell is cast on the staff, and stays there until it is released (WW p. 7).
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-subtle">1st-level spell</span>
            <select name="spell" required defaultValue="" className={selectCls}>
              <option value="" disabled>
                Choose a spell
              </option>
              {spells.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <Problem text={loadState.error} />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={close} disabled={loading} className={plainBtn}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className={limeBtn}>
              {loading ? "Loading…" : "Cast on the staff"}
            </button>
          </div>
        </form>
      )}

      {mode === "release" && (
        <form action={releaseAction} className="flex flex-col gap-2 border-t border-[#262920] pt-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="slot" value={slot.slot} />
          <p className="text-sm text-muted">Release {slot.spellName}? The slot will be empty until the spell is cast on the staff again.</p>
          <Problem text={releaseState.error} />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={close} disabled={releasing} className={plainBtn}>
              Keep it
            </button>
            <button type="submit" disabled={releasing} className={limeBtn}>
              {releasing ? "Releasing…" : `Yes, release ${slot.spellName}`}
            </button>
          </div>
        </form>
      )}

      {mode === "void" && (
        <form action={voidAction} className="flex flex-col gap-2 border-t border-[#262920] pt-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="slot" value={slot.slot} />
          <p className="text-sm text-muted">Void clears the slot by ruling, without the spell being released. The player sees the note.</p>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-subtle">Why</span>
            <input
              name="note"
              required
              maxLength={STAFF_NOTE_MAX}
              placeholder="The staff broke in the fall."
              className="min-h-11 min-w-0 rounded-xl border border-line-2 bg-ink px-3 text-[15px] text-parchment"
            />
          </label>
          <Problem text={voidState.error} />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={close} disabled={voiding} className={plainBtn}>
              Cancel
            </button>
            <button type="submit" disabled={voiding} className={emberBtn}>
              {voiding ? "Voiding…" : "Void the spell"}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

export function StaffSlots({
  id,
  slots,
  spells,
  canUse,
  canVoid,
  hasFocus,
}: {
  id: string;
  slots: StaffSlotView[];
  spells: { key: string; name: string }[];
  canUse: boolean;
  canVoid: boolean;
  hasFocus: boolean;
}) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-2">
      {slots.map((s) => (
        <Slot key={s.slot} id={id} slot={s} spells={spells} canUse={canUse} canVoid={canVoid} hasFocus={hasFocus} />
      ))}
    </ul>
  );
}

export type FocusOption = { id: string; name: string };

/** Chooses which carried item is the staff or wand. */
export function FocusPicker({ id, current, options }: { id: string; current: string | null; options: FocusOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(setSpellFocus, idle);
  useCloseOnSuccess(state, () => setOpen(false));

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={smallBtn}>
        {current ? "Change staff or wand" : "Set as spell focus"}
      </button>
    );
  }
  return (
    <form action={action} className="flex w-full flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1">
        <span className="text-xs text-subtle">Staff or wand from this character&apos;s gear</span>
        <select name="itemId" defaultValue={current ?? ""} className={selectCls}>
          <option value="">None</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <Problem text={state.error} />
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} disabled={pending} className={plainBtn}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={limeBtn}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
