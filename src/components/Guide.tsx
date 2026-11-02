"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { markGuideSeen } from "@/app/(app)/guide/actions";
import type { GuideKey, GuideStep } from "@/lib/guide";

/** Sent by the nav's Guide button. A guide on the page cancels it and opens; otherwise the button opens the welcome guide. */
const GUIDE_EVENT = "eris:guide";

// Guides closed during this visit, so moving between pages doesn't reopen one before the server knows.
const closedThisVisit = new Set<string>();

type Box = { top: number; left: number; width: number; height: number };
type Layout = { hole: Box | null; card: { top: number; left: number } };

const PAD = 6; // between the target and the edge of the spotlight
const GAP = 12; // between the spotlight and the card
const GUTTER = 16;
const CARD_WIDTH = 380;

// Some targets exist twice (top nav and the phone tab bar); take the one that's showing.
const targetOf = (step: GuideStep | null) =>
  step?.target
    ? ([...document.querySelectorAll<HTMLElement>(`[data-guide="${step.target}"]`)].find((el) => el.getClientRects().length > 0) ??
      null)
    : null;

const sameBox = (a: Box | null, b: Box | null) =>
  a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

/** Where the card goes: below the target if it fits, above if not, otherwise pinned to the bottom of the screen. */
function place(hole: Box | null, cardHeight: number): Layout["card"] {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(CARD_WIDTH, vw - 2 * GUTTER);
  if (!hole) return { top: Math.max(GUTTER, (vh - cardHeight) / 2), left: (vw - width) / 2 };
  const below = hole.top + hole.height + GAP;
  const above = hole.top - GAP - cardHeight;
  const top = below + cardHeight <= vh - GUTTER ? below : above >= GUTTER ? above : vh - GUTTER - cardHeight;
  return { top, left: Math.min(Math.max(hole.left, GUTTER), vw - GUTTER - width) };
}

/**
 * A step-by-step tour that dims the page and points at one `data-guide` element at a time.
 * It opens on its own until the viewer finishes or skips it once; the nav's Guide button replays it.
 */
export function Guide({
  guide,
  steps,
  autoStart,
  forceOpen = false,
}: {
  guide: GuideKey;
  steps: GuideStep[];
  autoStart: boolean;
  forceOpen?: boolean;
}) {
  const [index, setIndex] = useState<number | null>(() =>
    forceOpen || (autoStart && !closedThisVisit.has(guide)) ? 0 : null,
  );
  const [layout, setLayout] = useState<Layout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const step = index === null ? null : steps[index];
  const last = index === steps.length - 1;

  const close = useCallback(() => {
    closedThisVisit.add(guide);
    setIndex(null);
    setLayout(null);
    void markGuideSeen(guide);
    const url = new URL(window.location.href);
    if (url.searchParams.has("guide")) {
      url.searchParams.delete("guide");
      window.history.replaceState(null, "", url);
    }
    returnFocus.current?.focus();
  }, [guide]);

  const go = useCallback(
    (to: number) => {
      if (to >= steps.length) close();
      else setIndex(Math.max(0, to));
    },
    [steps.length, close],
  );

  // The nav's Guide button.
  useEffect(() => {
    const open = (e: Event) => {
      e.preventDefault();
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setIndex(0);
    };
    window.addEventListener(GUIDE_EVENT, open);
    return () => window.removeEventListener(GUIDE_EVENT, open);
  }, []);

  // New step: scroll its target near the top, which leaves room for the card below it, and move focus to the card.
  // The phone tab bar is fixed to the screen, so its targets need no scrolling.
  useEffect(() => {
    if (!step) return;
    const el = targetOf(step);
    const r = el?.closest("[data-tabbar]") ? null : el?.getBoundingClientRect();
    if (r) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: Math.max(0, window.scrollY + r.top - 2 * GUTTER), behavior: reduce ? "auto" : "smooth" });
    }
    cardRef.current?.focus({ preventScroll: true });
  }, [step]);

  // Follow the target every frame, so smooth scrolling, resizing and late layout shifts all stay lined up.
  useEffect(() => {
    if (!step) return;
    let frame = requestAnimationFrame(function track() {
      const r = targetOf(step)?.getBoundingClientRect();
      const hole = r && r.width > 0 ? { top: r.top - PAD, left: r.left - PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD } : null;
      const card = place(hole, cardRef.current?.offsetHeight ?? 0);
      setLayout((prev) =>
        prev && sameBox(prev.hole, hole) && prev.card.top === card.top && prev.card.left === card.left ? prev : { hole, card },
      );
      frame = requestAnimationFrame(track);
    });
    return () => cancelAnimationFrame(frame);
  }, [step]);

  // A step that asks for a press ends the guide when the reader presses the real control.
  useEffect(() => {
    const el = step?.action ? targetOf(step) : null;
    if (!el) return;
    el.addEventListener("click", close);
    return () => el.removeEventListener("click", close);
  }, [step, close]);

  // Esc skips, arrows move, and Tab stays inside the card.
  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowRight" && !step.action) {
        e.preventDefault();
        go(index! + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(index! - 1);
      } else if (e.key === "Tab" && cardRef.current) {
        const items = [...cardRef.current.querySelectorAll<HTMLElement>("button:not(:disabled)")];
        if (items.length === 0) return;
        const at = items.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : at === items.length - 1 ? 0 : at + 1;
        e.preventDefault();
        items[next].focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [step, index, go, close]);

  if (!step || index === null) return null;
  const hole = layout?.hole ?? null;
  const vw = typeof window === "undefined" ? 0 : window.innerWidth;
  const vh = typeof window === "undefined" ? 0 : window.innerHeight;
  const blocker = "fixed z-[100]";

  return (
    <>
      {layout &&
        (hole ? (
          <>
            {/* The spotlight: a clear box whose huge shadow dims everything else. */}
            <div
              aria-hidden="true"
              className="pointer-events-none fixed z-[100] rounded-2xl ring-2 ring-lime shadow-[0_0_0_9999px_rgb(8_9_7/0.74)] motion-safe:transition-all motion-safe:duration-200"
              style={hole}
            />
            {/* Clicks outside the spotlight do nothing. Inside it, only a step that asks for a press lets them through. */}
            {step.action ? (
              <>
                <div className={blocker} style={{ top: 0, left: 0, width: vw, height: Math.max(0, hole.top) }} />
                <div className={blocker} style={{ top: hole.top + hole.height, left: 0, width: vw, height: Math.max(0, vh - hole.top - hole.height) }} />
                <div className={blocker} style={{ top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height }} />
                <div className={blocker} style={{ top: hole.top, left: hole.left + hole.width, width: Math.max(0, vw - hole.left - hole.width), height: hole.height }} />
              </>
            ) : (
              <div className={`${blocker} inset-0`} />
            )}
          </>
        ) : (
          <div className={`${blocker} inset-0 bg-[rgb(8_9_7/0.74)]`} />
        ))}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        className={`fixed z-[101] flex w-[min(380px,calc(100vw-32px))] flex-col gap-3 rounded-2xl border border-[#4b5e2a] bg-surface p-5 shadow-2xl outline-none ${
          layout ? "" : "invisible"
        }`}
        style={layout?.card ?? { top: 0, left: 0 }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-lime">
            Guide · {index + 1} of {steps.length}
          </span>
          <button type="button" onClick={close} className="min-h-11 rounded-lg px-2 text-[13px] text-subtle hover:text-parchment">
            {last ? "Close" : "Skip guide"}
          </button>
        </div>
        <h2 id={titleId} className="font-display text-[28px] leading-tight text-parchment-2">
          {step.title}
        </h2>
        <p id={bodyId} className="text-[15px] leading-relaxed text-[#d6d2c2]">
          {step.body}
          {step.source && <span className="mt-1.5 block text-xs text-subtle">{step.source}</span>}
        </p>
        <div aria-hidden="true" className="flex gap-1.5">
          {steps.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= index ? "bg-lime" : "bg-[#2b3122]"}`} />
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {index > 0 ? (
            <button
              type="button"
              onClick={() => go(index - 1)}
              className="min-h-11 rounded-xl border border-line-2 px-4 text-sm text-[#d6d2c2] hover:border-lime"
            >
              Back
            </button>
          ) : (
            <span />
          )}
          {step.action ? (
            <span className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={close}
                className="min-h-11 rounded-xl border border-line-2 px-4 text-sm text-[#d6d2c2] hover:border-lime"
              >
                Later
              </button>
              <button
                type="button"
                onClick={() => targetOf(step)?.click()}
                className="min-h-11 rounded-xl bg-lime px-4 text-sm font-semibold text-lime-ink hover:brightness-110"
              >
                {step.action}
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => go(index + 1)}
              className="min-h-11 rounded-xl bg-lime px-4 text-sm font-semibold text-lime-ink hover:brightness-110"
            >
              {index === 0 && !step.target ? "Show me around" : last ? "Done" : "Next"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/** Replays the guide for this page, or opens the welcome guide on the party page when this page has none. */
export function GuideButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      data-guide="nav-guide"
      onClick={() => {
        if (window.dispatchEvent(new Event(GUIDE_EVENT, { cancelable: true }))) router.push("/party?guide=1");
      }}
      className="min-h-11 rounded-lg border border-line px-3 text-sm text-muted hover:text-parchment"
    >
      Guide
    </button>
  );
}
