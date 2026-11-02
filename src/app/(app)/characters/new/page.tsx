import Link from "next/link";
import { Nav } from "@/components/Nav";
import { PageHeader, Panel } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { SubmitButton } from "../[id]/build/forms";
import { startCharacter } from "../actions";

export const metadata = { title: "New character" };

export default async function NewCharacterPage() {
  const viewer = await requireUser();
  return (
    <>
      <Nav viewer={viewer} active="party" />
      <main className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader eyebrow="Woundwort's Warren · Men & Magic" title="New character" />
        <Panel title="How it works">
          <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-[#d6d2c2]">
            <li>Roll 3d6 six times and arrange the results across your abilities.</li>
            <li>Choose race, class, alignment and a name.</li>
            <li>Roll hit points: 1d6 adjusted by class and Constitution, at least 3.</li>
            <li>Roll starting gold: 3d6 × 10.</li>
            <li>Pick a starting kit from the price list, then send the character to Jay.</li>
          </ol>
          <p className="text-sm text-muted">
            Each character gets one set of ability rolls. Every roll is public in the roll log, and only Jay or the admin
            can grant a re-roll.
          </p>
        </Panel>
        <form action={startCharacter}>
          <SubmitButton pendingText="Rolling…">Roll 3d6 six times</SubmitButton>
        </form>
        <p className="text-sm text-muted">
          Already playing a character on paper or PDF?{" "}
          <Link href="/characters/import" className="text-moon underline-offset-4 hover:underline">
            Upload your sheet
          </Link>{" "}
          instead.
        </p>
      </main>
    </>
  );
}
