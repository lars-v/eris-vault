import { redirect } from "next/navigation";
import { enabledProviders } from "@/auth";
import { Moons } from "@/components/Moons";
import { SignInButtons } from "@/components/SignInButtons";
import { getCurrentUser } from "@/lib/session";

export default async function Home() {
  const viewer = await getCurrentUser();
  if (viewer) redirect(viewer.status === "blocked" ? "/blocked" : "/party");

  return (
    <main className="mx-auto flex min-h-screen max-w-[880px] flex-col justify-center gap-8 px-4 py-16 sm:px-8">
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-lime">
        <Moons size={22} />
        Planet Eris · OD&amp;D campaign
      </div>
      <h1 className="font-display text-6xl leading-none text-parchment-2 sm:text-7xl">Eris Vault</h1>
      <p className="max-w-[640px] text-lg leading-relaxed text-[#c9c5b4]">
        Character keeper for the table at Rath Denacht. Sign in to see the party, build characters by Woundwort&apos;s
        Warren and the brown books, and roll in the open, with every roll kept on record.
      </p>
      <SignInButtons providers={enabledProviders} redirectTo="/party" />
      <p className="text-sm text-subtle">
        Anyone with a GitHub{enabledProviders.includes("google") ? " or Google" : ""} account can sign in and read every
        sheet. GitHub sign-ins need an email GitHub has verified.{" "}
        <a href="/privacy" className="underline-offset-4 hover:underline">
          Privacy
        </a>
      </p>
    </main>
  );
}
