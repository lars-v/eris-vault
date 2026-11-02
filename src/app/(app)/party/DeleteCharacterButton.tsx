"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteFromParty } from "../characters/actions";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-9 rounded-lg border border-[#5c3328] px-3 text-[13px] font-semibold text-ember hover:bg-[#2e1a15] disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Yes, delete"}
    </button>
  );
}

/** Two-step delete on a party card. The character's rolls stay in the roll log. */
export function DeleteCharacterButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${name}`}
        className="relative z-10 min-h-9 rounded-lg px-2 text-[13px] text-subtle hover:text-ember"
      >
        Delete
      </button>
    );
  }

  return (
    <form action={deleteFromParty} className="relative z-10 flex w-full flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="basis-full text-[13px] text-muted">Delete {name}? Rolls stay in the log.</span>
      <ConfirmButton />
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="min-h-9 rounded-lg border border-line-2 px-3 text-[13px] text-[#d6d2c2] hover:border-lime"
      >
        Cancel
      </button>
    </form>
  );
}
