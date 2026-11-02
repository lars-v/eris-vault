import Link from "next/link";
import { Nav } from "@/components/Nav";
import { PageHeader, Panel } from "@/components/ui";
import { openSheetUploads } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { SubmitButton } from "../[id]/build/forms";
import { uploadSheet } from "../actions";

export const metadata = { title: "Upload a character sheet" };

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const viewer = await requireUser();
  const { error } = await searchParams;
  const open = await openSheetUploads(viewer.userId);

  return (
    <>
      <Nav viewer={viewer} active="party" />
      <main className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-10 sm:px-8">
        <PageHeader eyebrow="Already playing?" title="Upload a character sheet" />
        <Panel title="How it works">
          <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-[#d6d2c2]">
            <li>Upload your sheet. A filled-in PDF of the Planet Eris sheet or the OD&amp;D sheet is read for you.</li>
            <li>Check the numbers. Fix anything the app read wrong, and fill in what it couldn&apos;t read.</li>
            <li>Send it to Jay. Jay compares it with your sheet and approves it.</li>
          </ol>
          <p className="text-sm text-muted">
            A photo or scan works too (PNG or JPEG). You type the numbers in, and Jay checks them against the picture. Your
            sheet&apos;s numbers were not rolled here, so nothing shows in the roll log. Anything that doesn&apos;t match the
            books is listed for Jay.
          </p>
        </Panel>

        {error && (
          <div role="alert" className="rounded-xl border border-[#5c3328] bg-[#2e1a15] px-4 py-3 text-sm text-ember">
            {error}
          </div>
        )}

        <Panel title="Your sheet">
          <form action={uploadSheet} className="flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-muted">PDF, PNG or JPEG, up to 8 MB</span>
              <input
                type="file"
                name="sheet"
                required
                accept="application/pdf,.pdf,image/png,image/jpeg"
                className="rounded-xl border border-line-2 bg-ink p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-[#d6d2c2]"
              />
            </label>
            <div>
              <SubmitButton pendingText="Reading…">Read my sheet</SubmitButton>
            </div>
          </form>
        </Panel>

        {open.length > 0 && (
          <Panel title="Not sent to Jay yet">
            <ul className="flex flex-col divide-y divide-[#262920]">
              {open.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate">{u.filename}</span>
                  <Link href={`/characters/import/${u.id}`} className="text-moon underline-offset-4 hover:underline">
                    Continue
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <p className="text-sm text-muted">
          Starting fresh instead?{" "}
          <Link href="/characters/new" className="text-moon underline-offset-4 hover:underline">
            Roll a new character
          </Link>
          .
        </p>
      </main>
    </>
  );
}
