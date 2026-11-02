"use client";

import { useActionState, useState } from "react";
import { createClaimLink, type ClaimLinkState } from "./actions";

export function ClaimLinkForm() {
  const [state, action, pending] = useActionState<ClaimLinkState, FormData>(createClaimLink, {});
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1.5 text-[13px] text-muted">
          Note (who it&apos;s for)
          <input
            name="note"
            defaultValue="Jay"
            className="min-h-11 rounded-xl border border-line-2 bg-ink px-3.5 text-[15px] text-parchment"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-xl bg-amber px-5 text-sm font-semibold text-[#1a1408] disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create link"}
        </button>
      </form>
      {state.url && (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-[#5e4720] bg-ink p-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <code className="min-w-0 flex-[1_1_260px] break-all font-mono text-[13px] text-[#e2d2b4]">{state.url}</code>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(state.url ?? "");
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
              className="min-h-10 rounded-lg border border-[#5e4720] px-3.5 text-[13px] text-amber"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <span className="text-xs text-subtle">Shown once. Send it to Jay privately, not in #dice.</span>
        </div>
      )}
      {state.error && <p className="text-sm text-ember">{state.error}</p>}
    </div>
  );
}
