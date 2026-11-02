import Link from "next/link";
import { signOut } from "@/auth";
import { GuideButton } from "@/components/Guide";
import { Logo } from "@/components/Logo";
import type { CurrentUser } from "@/lib/session";

export function Nav({ viewer, active }: { viewer: CurrentUser; active?: "party" | "rolls" | "gm" | "admin" | "account" }) {
  const item = (key: string) =>
    `rounded-lg px-3.5 py-2.5 text-[15px] ${
      active === key ? "bg-surface-2 font-medium text-parchment-2" : "text-muted hover:text-lime"
    }`;
  const initial = (viewer.name ?? "?").slice(0, 1).toUpperCase();
  const badge =
    viewer.role === "admin" ? (
      <span className="rounded-md bg-moon px-1.5 py-0.5 text-[11px] font-bold text-[#0e1420]">ADMIN</span>
    ) : viewer.role === "gm" ? (
      <span className="rounded-md bg-amber px-1.5 py-0.5 text-[11px] font-bold text-[#1a1408]">GM</span>
    ) : null;

  return (
    <nav aria-label="Main" className="border-b border-[#262920] bg-ink-2">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-7 gap-y-3 px-4 py-3.5 sm:px-8">
        <Link href="/party" className="flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-2xl">Eris Vault</span>
        </Link>
        <div className="flex flex-1 flex-wrap gap-1">
          <Link href="/party" className={item("party")}>
            Party
          </Link>
          <Link href="/rolls" data-guide="nav-rolls" className={item("rolls")}>
            Roll log
          </Link>
          {(viewer.role === "gm" || viewer.role === "admin") && (
            <Link href="/gm" data-guide="nav-gm" className={item("gm")}>
              GM tools
            </Link>
          )}
          {viewer.role === "admin" && (
            <Link href="/admin" data-guide="nav-admin" className={item("admin")}>
              Admin
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <GuideButton />
          <Link
            href="/account"
            data-guide="nav-account"
            title="Your account and linked sign-ins"
            className={`flex min-h-11 items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-3 text-sm hover:border-lime ${
              active === "account" ? "border-lime" : "border-line"
            }`}
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-[#2b3122] font-semibold text-lime">
              {initial}
            </span>
            <span>{viewer.name ?? "Signed in"}</span>
            {badge}
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-line px-3 text-sm text-muted hover:text-parchment"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
