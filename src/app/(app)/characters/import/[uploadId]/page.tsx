import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Chip, PageHeader, Panel } from "@/components/ui";
import { getSheetUpload } from "@/lib/queries";
import { ABILITIES, ABILITY_NAMES, ABILITY_SOURCE } from "@/lib/rules/abilities";
import { CLASS_NAMES } from "@/lib/rules/advancement";
import { ALIGNMENTS, RACES } from "@/lib/rules/creation";
import { importFlags } from "@/lib/rules/import";
import { draftFromFields } from "@/lib/sheets";
import { requireUser } from "@/lib/session";
import { SubmitButton } from "../../[id]/build/forms";
import { sendImport } from "../../actions";

export const metadata = { title: "Check your sheet" };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const field = "min-h-11 min-w-0 rounded-xl border border-line-2 bg-ink px-3 text-[15px] text-parchment";
const label = "flex flex-col gap-1.5 text-[13px] text-muted";
const BLANK_ROWS = 6;

export default async function ReviewImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ uploadId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const viewer = await requireUser();
  const { uploadId } = await params;
  const { error } = await searchParams;
  const upload = await getSheetUpload(uploadId);
  if (!upload || upload.ownerId !== viewer.userId) notFound();
  if (upload.characterId) redirect(`/characters/${upload.characterId}`);

  const d = draftFromFields(upload.fields);
  const readCount = Object.keys(upload.fields).length;
  const isImage = upload.contentType.startsWith("image/");
  const fileUrl = `/api/sheets/${upload.id}`;
  const rows = [...d.items, ...Array.from({ length: BLANK_ROWS }, () => null)];
  const scoresKnown = ABILITIES.every((a) => d.scores[a] !== null);
  // A preview of the flags Jay will see, worked out from the sheet as read.
  const preview =
    d.race && d.cls && d.alignment && d.xp !== null && scoresKnown && d.hpMax !== null
      ? importFlags(
          {
            race: d.race,
            cls: d.cls,
            alignment: d.alignment,
            xp: d.xp,
            scores: d.scores as Record<(typeof ABILITIES)[number], number>,
            hpCurrent: d.hpCurrent ?? d.hpMax,
            hpMax: d.hpMax,
            coinsGp: d.coinsGp ?? 0,
            items: d.items,
          },
          d.written,
        )
      : null;

  return (
    <>
      <Nav viewer={viewer} active="party" />
      <main className="mx-auto flex max-w-[1080px] flex-col gap-5 px-4 py-10 sm:px-8">
        <PageHeader eyebrow="Upload a character sheet · check" title={d.name || "Your character"}>
          <a href={fileUrl} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-xl border border-line-2 px-4 text-sm text-[#d6d2c2]">
            Open {upload.filename}
          </a>
        </PageHeader>

        <p className="max-w-[720px] text-[15px] leading-relaxed text-muted">
          {readCount > 0
            ? `The app read ${readCount} filled-in fields from your sheet. Check every box against your sheet and fix anything that's off.`
            : "The app couldn't read form fields from this file, so fill the boxes in from your sheet."}{" "}
          Jay sees the file and anything you change.
        </p>

        {error && (
          <div role="alert" className="rounded-xl border border-[#5c3328] bg-[#2e1a15] px-4 py-3 text-sm text-ember">
            {error}
          </div>
        )}

        {isImage && (
          <Panel title="Your sheet">
            {/* eslint-disable-next-line @next/next/no-img-element -- a private, per-user file */}
            <img src={fileUrl} alt={`Uploaded sheet ${upload.filename}`} className="max-h-[720px] w-full rounded-xl object-contain" />
          </Panel>
        )}

        <form action={sendImport} className="flex flex-col gap-5">
          <input type="hidden" name="uploadId" value={upload.id} />
          <input type="hidden" name="itemRows" value={rows.length} />

          <Panel title="Who they are" aside="WW pp. 7-10">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
              <label className={label}>
                Name
                <input name="name" required maxLength={60} defaultValue={d.name} className={field} />
              </label>
              <label className={label}>
                Race
                <select name="race" required defaultValue={d.race ?? ""} className={field}>
                  <option value="" disabled>
                    Choose…
                  </option>
                  {RACES.map((r) => (
                    <option key={r} value={r}>
                      {cap(r)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                Class
                <select name="cls" required defaultValue={d.cls ?? ""} className={field}>
                  <option value="" disabled>
                    Choose…
                  </option>
                  {Object.entries(CLASS_NAMES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                Alignment
                <select name="alignment" required defaultValue={d.alignment ?? ""} className={field}>
                  <option value="" disabled>
                    Choose…
                  </option>
                  {ALIGNMENTS.map((a) => (
                    <option key={a} value={a}>
                      {cap(a)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                Patron (optional)
                <input name="deity" maxLength={60} className={field} />
              </label>
            </div>
          </Panel>

          <Panel title="Ability scores" aside={ABILITY_SOURCE}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
              {ABILITIES.map((a) => (
                <label key={a} className={label}>
                  {ABILITY_NAMES[a]}
                  <input name={a} type="number" required min={3} max={18} step={1} defaultValue={d.scores[a] ?? ""} className={`${field} font-mono`} />
                </label>
              ))}
            </div>
          </Panel>

          <Panel title="Experience, hit points and coins">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
              <label className={label}>
                XP
                <input name="xp" type="number" required min={0} step={1} defaultValue={d.xp ?? ""} className={`${field} font-mono`} />
              </label>
              <label className={label}>
                Current hit points
                <input name="hpCurrent" type="number" required min={-99} max={999} step={1} defaultValue={d.hpCurrent ?? d.hpMax ?? ""} className={`${field} font-mono`} />
              </label>
              <label className={label}>
                Maximum hit points
                <input name="hpMax" type="number" required min={1} max={999} step={1} defaultValue={d.hpMax ?? ""} className={`${field} font-mono`} />
              </label>
              <label className={label}>
                Gold
                <input name="coinsGp" type="number" required step={1} defaultValue={d.coinsGp ?? 0} className={`${field} font-mono`} />
              </label>
              <label className={label}>
                Silver
                <input name="coinsSp" type="number" required min={0} step={1} defaultValue={0} className={`${field} font-mono`} />
              </label>
              <label className={label}>
                Copper
                <input name="coinsCp" type="number" required min={0} step={1} defaultValue={0} className={`${field} font-mono`} />
              </label>
            </div>
            <p className="text-xs text-subtle">Level and saving throw are worked out from XP and class, so they aren&apos;t typed in.</p>
          </Panel>

          <Panel title="Gear" aside="Units as written on your sheet">
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[1fr_88px_72px] gap-2 text-xs text-subtle">
                <span>Item</span>
                <span>Units</span>
                <span>Magic</span>
              </div>
              {rows.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_88px_72px] items-center gap-2">
                  <input name={`item${i}`} maxLength={80} defaultValue={it?.name ?? ""} aria-label={`Item ${i + 1}`} className={field} />
                  <input
                    name={`units${i}`}
                    type="number"
                    min={0}
                    max={99}
                    step={1}
                    defaultValue={it?.encUnits ?? ""}
                    aria-label={`Units for item ${i + 1}`}
                    className={`${field} font-mono`}
                  />
                  <label className="flex min-h-11 items-center justify-center">
                    <input type="checkbox" name={`magic${i}`} defaultChecked={it?.isMagic ?? false} aria-label={`Item ${i + 1} is magic`} className="h-5 w-5 accent-lime" />
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-subtle">Leave units blank if your sheet doesn&apos;t give them. Magic gear counts 0 (campaign ruling).</p>
          </Panel>

          <Panel title="Notes" aside="Spells, skills, retainers, anything else">
            <textarea name="notes" maxLength={4000} rows={8} defaultValue={d.notes} className={`${field} py-2 leading-relaxed`} />
          </Panel>

          {preview && preview.length > 0 && (
            <Panel title={`Jay will see ${preview.length} flag${preview.length === 1 ? "" : "s"}`} className="border-[#5e4720]">
              <p className="text-sm text-muted">From your sheet as read. You don&apos;t need to fix these: Jay decides.</p>
              <ul className="flex flex-col divide-y divide-[#262920]">
                {preview.map((f) => (
                  <li key={f.title} className="flex flex-col gap-1 py-3">
                    <span className="font-semibold">{f.title}</span>
                    <span className="text-sm text-muted">{f.body}</span>
                    <span className="font-mono text-xs text-subtle">{f.source}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton pendingText="Sending…">Send to Jay</SubmitButton>
            <Chip>Goes straight to Jay for approval</Chip>
            <Link href="/characters/import" className="text-sm text-moon underline-offset-4 hover:underline">
              Upload a different file
            </Link>
          </div>
        </form>
      </main>
    </>
  );
}
