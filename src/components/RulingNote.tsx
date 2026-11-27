import Link from "next/link";

/** A ruling as the sheet needs it (rulingsByKey in src/lib/queries.ts). */
export type RulingSummary = { key: string; question: string; answer: string | null; status: "pending" | "decided" };

/** Jay's answer once decided; until then a link for Jay and admins, or a note for players. */
export function RulingNote({ ruling, rulings, staff }: { ruling: string; rulings: RulingSummary[]; staff: boolean }) {
  const r = rulings.find((x) => x.key === ruling);
  if (r?.status === "decided" && r.answer) return <span className="block text-xs text-muted">Jay&apos;s ruling: {r.answer}</span>;
  return staff ? (
    <Link href={`/gm/rulings#ruling-${ruling}`} className="block text-xs text-lime underline-offset-4 hover:underline">
      Open ruling: {ruling}
    </Link>
  ) : (
    <span className="block text-xs text-subtle">Waiting on Jay&apos;s ruling ({ruling}).</span>
  );
}
