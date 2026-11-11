"use client";

import { startTransition, useActionState, useState } from "react";
import { Panel } from "@/components/ui";
import { NOTES_MAX } from "@/lib/limits";
import { saveNotes, type NotesResult } from "../notes-actions";

const idle: NotesResult = { error: null, at: 0 };

/**
 * Free-text notes on the sheet. Everyone can read them; the player who owns
 * the character, Jay and admins can edit or delete them (can.editPlayState).
 */
export function NotesPanel({ id, notes, canEdit }: { id: string; notes: string | null; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveNotes, idle);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(notes ?? "");

  // Close the editor after a successful save; keep it open (with the text) after a problem.
  const [seenAt, setSeenAt] = useState(0);
  if (state.at !== seenAt) {
    setSeenAt(state.at);
    if (!state.error) setEditing(false);
  }

  const send = (clear: boolean) => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("notes", clear ? "" : text);
    if (clear) fd.set("clear", "1");
    startTransition(() => action(fd));
  };

  const open = () => {
    setText(notes ?? "");
    setEditing(true);
  };

  return (
    <Panel
      title="Notes"
      aside={
        canEdit &&
        !editing && (
          <button
            type="button"
            onClick={open}
            className="min-h-9 rounded-lg border border-line-2 px-3 text-[13px] font-semibold text-[#d6d2c2] hover:border-lime"
          >
            {notes ? "Edit notes" : "Add notes"}
          </button>
        )
      }
    >
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(false);
          }}
          className="flex flex-col gap-3"
        >
          <label htmlFor={`notes-${id}`} className="sr-only">
            Notes
          </label>
          <textarea
            id={`notes-${id}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={NOTES_MAX}
            rows={Math.min(18, Math.max(6, text.split("\n").length + 2))}
            autoFocus
            className="rounded-xl border border-line-2 bg-ink px-3 py-2 text-[15px] leading-relaxed text-parchment"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-subtle">
              {text.length.toLocaleString("en-US")} of {NOTES_MAX.toLocaleString("en-US")} characters
            </span>
            <div className="flex flex-wrap gap-2">
              {notes && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (confirm("Delete all the notes on this character? This can't be undone.")) send(true);
                  }}
                  className="min-h-11 rounded-xl border border-[#5c3328] px-4 text-sm font-semibold text-ember hover:bg-[#2e1a15] disabled:opacity-60"
                >
                  Delete notes
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => setEditing(false)}
                className="min-h-11 rounded-xl border border-line-2 px-4 text-sm text-[#d6d2c2] hover:border-lime disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="min-h-11 rounded-xl bg-lime px-4 text-sm font-semibold text-lime-ink hover:brightness-110 disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save notes"}
              </button>
            </div>
          </div>
          {state.error && (
            <p role="alert" className="rounded-lg border border-[#5c3328] bg-[#2e1a15] px-3 py-2 text-sm text-ember">
              {state.error}
            </p>
          )}
        </form>
      ) : notes ? (
        <p className="whitespace-pre-line text-sm text-muted">{notes}</p>
      ) : (
        <p className="text-sm text-subtle">No notes yet.</p>
      )}
    </Panel>
  );
}
