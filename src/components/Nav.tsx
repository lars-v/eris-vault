import Link from "next/link";
import { signOut } from "@/auth";
import { GuideButton } from "@/components/Guide";
import { Logo } from "@/components/Logo";
import type { CurrentUser } from "@/lib/session";

type Tab = "party" | "rolls" | "gm" | "admin" | "account";

export function SignOutButton() {
  return (
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
  );
}

/**
 * Top bar on every screen, plus a bottom tab bar on phones. The tab bar repeats the
 * `data-guide` names so the first-time guide points at whichever copy is showing.
 */
export function Nav({ viewer, active }: { viewer: CurrentUser; active?: Tab }) {
  const item = (key: Tab) =>
    `rounded-lg px-3.5 py-2.5 text-[15px] ${
      active === key ? "bg-surface-2 font-medium text-parchment-2" : "text-muted hover:text-lime"
    }`;
  const tab = (key: Tab) =>
    `flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[13px] ${
      active === key ? "font-semibold text-lime" : "text-muted"
    }`;
  const staff = viewer.role === "gm" || viewer.role === "admin";
  const initial = (viewer.name ?? "?").slice(0, 1).toUpperCase();
  const badge =
    viewer.role === "admin" ? (
      <span className="rounded-md bg-moon px-1.5 py-0.5 text-[11px] font-bold text-[#0e1420]">ADMIN</span>
    ) : viewer.role === "gm" ? (
      <span className="rounded-md bg-amber px-1.5 py-0.5 text-[11px] font-bold text-[#1a1408]">GM</span>
    ) : null;
  const dot = (key: Tab) => (
    <span aria-hidden="true" className={`h-1 w-6 rounded-full ${active === key ? "bg-lime" : "bg-transparent"}`} />
  );

  return (
    <>
      <nav aria-label="Main" className="border-b border-[#262920] bg-ink-2">
        <div className="mx-auto flex max-w-[1280px] items-center gap-x-3 gap-y-3 px-4 py-2.5 sm:flex-wrap sm:gap-x-7 sm:px-8 sm:py-3.5">
          <Link href="/party" className="flex min-h-11 items-center gap-2.5">
            <Logo />
            <span className="font-display text-xl whitespace-nowrap sm:text-2xl">Eris Vault</span>
          </Link>
          <div className="hidden flex-1 flex-wrap gap-1 sm:flex">
            <Link href="/party" className={item("party")}>
              Party
            </Link>
            <Link href="/rolls" data-guide="nav-rolls" className={item("rolls")}>
              Roll log
            </Link>
            {staff && (
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
          <div className="ml-auto flex items-center gap-2">
            <GuideButton />
            <Link
              href="/account"
              data-guide="nav-account"
              title="Your account and linked sign-ins"
              aria-label="Your account"
              className={`flex min-h-11 items-center gap-2.5 rounded-full border p-1.5 hover:border-lime sm:pr-3 ${
                active === "account" ? "border-lime" : "border-line"
              }`}
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-[#2b3122] font-semibold text-lime">
                {initial}
              </span>
              <span className="hidden text-sm sm:inline">{viewer.name ?? "Signed in"}</span>
              <span className="hidden sm:inline">{badge}</span>
            </Link>
            <span className="hidden sm:block">
              <SignOutButton />
            </span>
          </div>
        </div>
      </nav>

      {/* Phones: the main links sit at the bottom, in thumb reach. globals.css pads the page for it. */}
      <nav
        aria-label="Sections"
        data-tabbar
        className="fixed inset-x-0 bottom-0 z-50 flex border-t border-[#262920] bg-ink-2 pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <Link href="/party" className={tab("party")} aria-current={active === "party" ? "page" : undefined}>
          {dot("party")}
          Party
        </Link>
        <Link href="/rolls" data-guide="nav-rolls" className={tab("rolls")} aria-current={active === "rolls" ? "page" : undefined}>
          {dot("rolls")}
          Roll log
        </Link>
        {staff && (
          <Link href="/gm" data-guide="nav-gm" className={tab("gm")} aria-current={active === "gm" ? "page" : undefined}>
            {dot("gm")}
            GM tools
          </Link>
        )}
        {viewer.role === "admin" && (
          <Link href="/admin" data-guide="nav-admin" className={tab("admin")} aria-current={active === "admin" ? "page" : undefined}>
            {dot("admin")}
            Admin
          </Link>
        )}
        <Link href="/account" className={tab("account")} aria-current={active === "account" ? "page" : undefined}>
          {dot("account")}
          Account
        </Link>
      </nav>
    </>
  );
}
