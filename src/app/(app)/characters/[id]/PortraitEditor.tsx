"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { savePortrait, type PortraitResult } from "../portrait-actions";

const idle: PortraitResult = { error: null, at: 0 };
// Same limits as src/lib/portraits.ts, checked here only to answer faster.
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/**
 * Add, change or remove the character's picture. Shown to the player who owns
 * the character, Jay and admins (can.editPortrait). The server checks again.
 */
export function PortraitEditor({ id, name, hasPortrait }: { id: string; name: string; hasPortrait: boolean }) {
  const [state, action, pending] = useActionState(savePortrait, idle);
  const [localError, setLocalError] = useState<string | null>(null);
  const [mode, setMode] = useState<"upload" | "remove" | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // A newer server answer replaces any message from the browser-side check.
  const [seenAt, setSeenAt] = useState(0);
  if (state.at !== seenAt) {
    setSeenAt(state.at);
    setLocalError(null);
  }
  const error = localError ?? state.error;

  const send = (fd: FormData, next: "upload" | "remove") => {
    fd.set("id", id);
    setMode(next);
    startTransition(() => action(fd));
  };

  const onPick = (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) return setLocalError("That picture is over 8 MB. Try a smaller one.");
    if (file.type && !ACCEPT.split(",").includes(file.type)) return setLocalError("Use a PNG, JPEG, WebP or GIF picture.");
    setLocalError(null);
    const fd = new FormData();
    fd.set("portrait", file);
    send(fd, "upload");
  };

  const button =
    "min-h-9 rounded-lg border px-3 text-[13px] font-semibold disabled:opacity-60";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          id={`portrait-${id}`}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => onPick(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => input.current?.click()}
          className={`${button} border-line-2 text-[#d6d2c2] hover:border-lime`}
        >
          {pending && mode === "upload" ? "Uploading…" : hasPortrait ? "Change picture" : "Add a picture"}
        </button>
        {hasPortrait && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm(`Remove the picture of ${name}?`)) {
                const fd = new FormData();
                fd.set("remove", "1");
                send(fd, "remove");
              }
            }}
            className={`${button} border-[#5c3328] text-ember hover:bg-[#2e1a15]`}
          >
            {pending && mode === "remove" ? "Removing…" : "Remove picture"}
          </button>
        )}
        {!hasPortrait && !pending && <span className="text-xs text-subtle">PNG, JPEG, WebP or GIF, up to 8 MB.</span>}
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-[#5c3328] bg-[#2e1a15] px-3 py-2 text-sm text-ember">
          {error}
        </p>
      )}
    </div>
  );
}
