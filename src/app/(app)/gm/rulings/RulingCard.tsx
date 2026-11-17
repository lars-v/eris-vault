"use client";

import { useActionState, useState } from "react";
import { Chip } from "@/components/ui";
import { NOW, RULING_ANSWER_MAX, type RulingExample } from "@/lib/ruling-examples";
import { decideRuling, type RulingResult } from "./actions";

const idle: RulingResult = { error: null, at: 0, key: null };

export type RulingView = {
  key: string;
  question: string;
  sources: string;
  answer: string | null;
  status: "pending" | "decided";
  decidedByName: string | null;
  decidedAt: string | null;
};

/**
 * One ruling. Open ones show the example answers and an answer box; ones on
 * file show the answer and a "Change answer" button that opens the same editor.
 */
export function RulingCard({ ruling, examples }: { ruling: RulingView; examples: RulingExample[] }) {
  const [state, action, pending] = useActionState(decideRuling, idle);
  const open = ruling.status === "pending";
  const [editing, setEditing] = useState(open);
  const [text, setText] = useState(ruling.answer ?? "");

  // Close the editor of an answer on file after a successful change.
  const [seenAt, setSeenAt] = useState(0);
  if (state.at !== seenAt) {
    setSeenAt(state.at);
    if (!state.error && !open) setEditing(false);
  }

  const boxId = `answer-${ruling.key}`;

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-[15px] leading-snug text-parchment">{ruling.question}</p>
        <p className="text-xs text-subtle">{ruling.sources}</p>
      </div>

      {!open && !editing && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="whitespace-pre-line text-sm text-lime">{ruling.answer}</p>
            <p className="text-xs text-subtle">
              {ruling.decidedAt
                ? `Answered by ${ruling.decidedByName ?? "unknown"}, ${ruling.decidedAt}`
                : "On file from the start"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setText(ruling.answer ?? "");
              setEditing(true);
            }}
            className="min-h-11 rounded-xl border border-line-2 px-4 text-sm text-soft hover:border-lime"
          >
            Change answer
          </button>
        </div>
      )}

      {editing && (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="key" value={ruling.key} />
          {examples.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-xs font-semibold text-amber">Example answers · pick one to start from</legend>
              {examples.map((ex) => {
                const chosen = text.trim() === ex.answer;
                return (
                  <button
                    key={ex.answer}
                    type="button"
                    aria-pressed={chosen}
                    onClick={() => setText(ex.answer)}
                    className={`flex min-h-11 flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left text-sm ${
                      chosen ? "border-lime bg-lime-wash text-parchment" : "border-line-2 text-soft hover:border-lime"
                    }`}
                  >
                    <span>{ex.answer}</span>
                    {ex.basis && (ex.basis === NOW ? <Chip tone="moon">{NOW}</Chip> : <span className="text-xs text-subtle">{ex.basis}</span>)}
                  </button>
                );
              })}
            </fieldset>
          )}
          <label htmlFor={boxId} className="text-xs font-semibold text-subtle">
            Your answer
          </label>
          <textarea
            id={boxId}
            name="answer"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={RULING_ANSWER_MAX}
            rows={3}
            placeholder="Pick an example above, change it, or write your own."
            className="rounded-xl border border-line-2 bg-ink px-3 py-2 text-[15px] leading-relaxed text-parchment"
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!open && (
              <button
                type="button"
                disabled={pending}
                onClick={() => setEditing(false)}
                className="min-h-11 rounded-xl border border-line-2 px-4 text-sm text-soft hover:border-lime disabled:opacity-60"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={pending || text.trim() === ""}
              className="min-h-11 rounded-xl bg-lime px-4 text-sm font-semibold text-lime-ink hover:brightness-110 disabled:opacity-60"
            >
              {pending ? "Saving…" : open ? "Record ruling" : "Save answer"}
            </button>
          </div>
          {state.error && (
            <p role="alert" className="rounded-lg border border-ember-edge bg-ember-wash px-3 py-2 text-sm text-ember">
              {state.error}
            </p>
          )}
        </form>
      )}
    </li>
  );
}
