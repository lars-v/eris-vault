import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy · Eris Vault" };

export default function Privacy() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[720px] flex-col gap-6 px-4 py-16 sm:px-8">
      <h1 className="font-display text-5xl text-parchment-2">Privacy</h1>
      <p className="text-lg leading-relaxed text-[#c9c5b4]">
        Eris Vault is a character keeper for one private OD&amp;D table. It is run by Lars von Sneidern, not by a
        company, and it has no ads or tracking.
      </p>

      <section className="flex flex-col gap-3 leading-relaxed text-muted">
        <h2 className="font-display text-2xl text-parchment-2">What it keeps</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            From GitHub or Google sign-in: your name, email address and profile picture, plus the sign-in record those
            services return. Nothing else is requested from your account.
          </li>
          <li>Your characters, their gear, and every dice roll made in the app.</li>
          <li>A log of changes made by the game master and the admin.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-3 leading-relaxed text-muted">
        <h2 className="font-display text-2xl text-parchment-2">Who can see it</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Everyone signed in can see every character sheet, every dice roll and your display name.</li>
          <li>The game master and the admin can also see email addresses and the change log.</li>
          <li>Nothing is sold or shared with anyone else.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-3 leading-relaxed text-muted">
        <h2 className="font-display text-2xl text-parchment-2">Where it lives</h2>
        <p>The app and its database are hosted on Railway in the United States.</p>
      </section>

      <section className="flex flex-col gap-3 leading-relaxed text-muted">
        <h2 className="font-display text-2xl text-parchment-2">Removing your data</h2>
        <p>
          Email{" "}
          <a href="mailto:lars@vonsneidern.net" className="text-moon underline-offset-4 hover:underline">
            lars@vonsneidern.net
          </a>{" "}
          to have your account and characters deleted.
        </p>
      </section>

      <Link href="/" className="text-moon underline-offset-4 hover:underline">
        Back to Eris Vault
      </Link>
    </main>
  );
}
