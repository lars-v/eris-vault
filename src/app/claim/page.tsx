import { enabledProviders } from "@/auth";
import { SignInButtons } from "@/components/SignInButtons";
import { getCurrentUser } from "@/lib/session";
import { ClaimForm } from "./ClaimForm";

export const metadata = { title: "Claim game master" };

export default async function ClaimPage() {
  const viewer = await getCurrentUser();
  return (
    <main className="mx-auto flex min-h-screen max-w-[720px] flex-col justify-center gap-6 px-4 py-16 sm:px-8">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber">One-time link</div>
      <h1 className="font-display text-5xl leading-none text-parchment-2">Claim game master</h1>
      <p className="text-lg leading-relaxed text-[#c9c5b4]">
        This link makes the account that uses it the game master for Eris Vault. It works once and expires 48 hours
        after it was made.
      </p>
      {viewer && (
        <p className="text-sm text-subtle">
          Signed in as <span className="text-parchment">{viewer.name ?? "you"}</span>.
        </p>
      )}
      <ClaimForm signedIn={Boolean(viewer)} />
      {!viewer && <SignInButtons providers={enabledProviders} redirectTo="/claim" />}
    </main>
  );
}
