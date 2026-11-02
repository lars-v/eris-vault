"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { claimGm, type ClaimState } from "./actions";

const KEY = "eris-gm-claim";

/**
 * The code arrives after the # in the link, so it never reaches the server's
 * logs. It is kept in this tab's session storage while the person signs in,
 * then sent once with the claim.
 */
export function ClaimForm({ signedIn }: { signedIn: boolean }) {
  const [code, setCode] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ClaimState, FormData>(claimGm, {});

  useEffect(() => {
    let fromHash = "";
    try {
      fromHash = window.location.hash.slice(1);
      if (fromHash) {
        sessionStorage.setItem(KEY, fromHash);
        history.replaceState(null, "", window.location.pathname);
      }
      // Reading browser-only storage after mount is intended here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCode(fromHash || sessionStorage.getItem(KEY));
    } catch {
      setCode(fromHash || null);
    }
  }, []);

  useEffect(() => {
    if (state.ok) {
      try {
        sessionStorage.removeItem(KEY);
      } catch {}
    }
  }, [state.ok]);

  if (state.ok) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-lg text-lime">You&apos;re the game master now.</p>
        <Link href="/gm" className="w-fit rounded-xl bg-amber px-5 py-3 font-semibold text-[#1a1408]">
          Open GM tools
        </Link>
      </div>
    );
  }

  if (!code) {
    return <p className="text-muted">This page needs the full claim link. Open the link you were sent again.</p>;
  }

  if (!signedIn) {
    return <p className="text-muted">Sign in below, and you&apos;ll come straight back here to finish.</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="code" value={code} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-fit rounded-xl bg-amber px-5 font-semibold text-[#1a1408] disabled:opacity-60"
      >
        {pending ? "Claiming…" : "Claim game master"}
      </button>
      {state.error && <p className="text-ember">{state.error}</p>}
    </form>
  );
}
