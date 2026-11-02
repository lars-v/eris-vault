import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Chip, PageHeader, Panel } from "@/components/ui";
import { listAudit, listCharacters, listPeople } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { importLiz, setRole, setStatus } from "./actions";
import { ClaimLinkForm } from "./ClaimLinkForm";

export const metadata = { title: "Admin" };

function Setting({ label, detail, ok }: { label: string; detail: string; ok: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#262920] py-3">
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px]">{label}</span>
        <span className="font-mono text-[11px] text-subtle">{detail}</span>
      </span>
      {ok ? <Chip tone="lime">Set</Chip> : <Chip tone="amber">Not set</Chip>}
    </div>
  );
}

function ActionButton({ action, userId, field, value, children, tone = "plain" }: {
  action: (fd: FormData) => Promise<void>;
  userId: string;
  field: "role" | "status";
  value: string;
  children: React.ReactNode;
  tone?: "plain" | "ember";
}) {
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name={field} value={value} />
      <button
        type="submit"
        className={`min-h-9 rounded-lg border px-2.5 text-[13px] ${
          tone === "ember" ? "border-[#5c3328] text-ember" : "border-line-2 text-[#d6d2c2] hover:border-moon"
        }`}
      >
        {children}
      </button>
    </form>
  );
}

export default async function AdminPage() {
  const viewer = await requireAdmin();
  const [people, audit, party] = await Promise.all([listPeople(), listAudit(), listCharacters()]);
  const gmCount = people.filter((p) => p.role === "gm").length;
  const blocked = people.filter((p) => p.status === "blocked").length;
  const hasLiz = party.some((c) => c.name === "Liz the Giz");

  return (
    <>
      <Nav viewer={viewer} active="admin" />
      <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-10 sm:px-8">
        <PageHeader eyebrow="Admin · full control" title="Vault control" tone="moon">
          <Link href="/gm" className="inline-flex min-h-11 items-center rounded-xl border border-line-2 px-4 text-sm text-[#d6d2c2]">
            Open GM tools
          </Link>
        </PageHeader>
        <p className="-mt-2 max-w-[720px] text-[15px] text-muted">
          Everything Jay can do, plus roles and settings. Every action here goes in the audit log, and Jay can read it.
        </p>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          <div className="flex flex-col gap-1 rounded-2xl border border-[#34496b] bg-[#141822] p-4">
            <span className="text-xs uppercase tracking-[0.1em] text-[#9faac0]">Your admin comes from</span>
            <span className="text-[17px] font-semibold">{viewer.railwayAdmin ? "Railway list" : "Granted in the app"}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
            <span className="text-xs uppercase tracking-[0.1em] text-subtle">Game masters</span>
            <span className={`text-[17px] font-semibold ${gmCount ? "" : "text-amber"}`}>{gmCount || "None yet"}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
            <span className="text-xs uppercase tracking-[0.1em] text-subtle">Accounts</span>
            <span className="font-mono text-[22px]">{people.length}</span>
            <span className="text-xs text-subtle">{blocked} blocked</span>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
            <span className="text-xs uppercase tracking-[0.1em] text-subtle">Audit log</span>
            <span className="font-mono text-[22px]">{audit.length}</span>
            <span className="text-xs text-subtle">latest entries shown below</span>
          </div>
        </div>

        <Panel title="People and roles">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.1em] text-subtle">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Account</th>
                  <th className="py-2 pr-3 font-semibold">Signs in with</th>
                  <th className="py-2 pr-3 font-semibold">Role</th>
                  <th className="py-2 pr-3 font-semibold">Characters</th>
                  <th className="py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.userId} className="border-t border-[#262920] align-top">
                    <td className="py-3 pr-3">
                      <span className="font-semibold">{p.name ?? "Unnamed"}</span>
                      <span className="block text-xs text-subtle">{p.email}</span>
                    </td>
                    <td className="py-3 pr-3 text-muted">{p.providers.map((x) => (x === "github" ? "GitHub" : "Google")).join(", ")}</td>
                    <td className="py-3 pr-3">
                      <span className="flex flex-wrap gap-1.5">
                        {p.railwayAdmin ? <Chip tone="moon">Admin · Railway</Chip> : p.role === "admin" ? <Chip tone="moon">Admin</Chip> : p.role === "gm" ? <Chip tone="amber">GM</Chip> : <Chip>Player</Chip>}
                        {p.status === "blocked" && <Chip tone="ember">Blocked</Chip>}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-[#d6d2c2]">{p.characters.join(", ") || "None"}</td>
                    <td className="py-3">
                      {p.railwayAdmin || p.userId === viewer.userId ? (
                        <span className="text-[13px] text-subtle">{p.railwayAdmin ? "Locked here; change on Railway" : "That's you"}</span>
                      ) : (
                        <span className="flex flex-wrap gap-1.5">
                          {p.role !== "gm" && <ActionButton action={setRole} userId={p.userId} field="role" value="gm">Make GM</ActionButton>}
                          {p.role === "gm" && <ActionButton action={setRole} userId={p.userId} field="role" value="player">Remove GM</ActionButton>}
                          {p.role !== "admin" && <ActionButton action={setRole} userId={p.userId} field="role" value="admin">Make admin</ActionButton>}
                          {p.role === "admin" && <ActionButton action={setRole} userId={p.userId} field="role" value="player">Remove admin</ActionButton>}
                          {p.status === "active" ? (
                            <ActionButton action={setStatus} userId={p.userId} field="status" value="blocked" tone="ember">Block</ActionButton>
                          ) : (
                            <ActionButton action={setStatus} userId={p.userId} field="status" value="active">Unblock</ActionButton>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="flex flex-wrap items-start gap-5">
          <Panel title="GM claim link" className="min-w-0 flex-[1_1_440px] border-[#5e4720]">
            <p className="text-sm leading-relaxed text-muted">
              Works once, expires 48 hours after you create it, and only a hash of the code is stored. Whoever opens it
              and signs in becomes GM.
            </p>
            <ClaimLinkForm />
          </Panel>

          <Panel title="Settings" className="min-w-0 flex-[1_1_520px]">
            <Setting label="GitHub sign-in" detail="AUTH_GITHUB_ID, AUTH_GITHUB_SECRET" ok={Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET)} />
            <Setting label="Google sign-in" detail="AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET" ok={Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)} />
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#262920] py-3">
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px]">Sample character</span>
                <span className="text-xs text-subtle">Liz the Giz from your PDF sheet, with her 5 flags for Jay</span>
              </span>
              {hasLiz ? (
                <Chip tone="lime">Imported</Chip>
              ) : (
                <form action={importLiz}>
                  <button type="submit" className="min-h-10 rounded-lg border border-line-2 px-3 text-[13px] text-[#d6d2c2] hover:border-lime">
                    Import Liz
                  </button>
                </form>
              )}
            </div>
          </Panel>
        </div>

        <Panel title="Audit log" aside="Jay sees this list too">
          {audit.length === 0 ? (
            <p className="text-sm text-muted">Nothing logged yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[#262920]">
              {audit.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-3 py-2.5 text-sm">
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className={a.actorRole === "admin" ? "font-semibold text-moon" : a.actorRole === "gm" ? "font-semibold text-amber" : "font-semibold"}>
                      {a.actorName ?? "System"}
                    </span>
                    <span className="font-mono text-xs text-muted">{a.action}</span>
                    {a.after != null && <span className="font-mono text-xs text-subtle">{JSON.stringify(a.after)}</span>}
                  </span>
                  <time className="text-xs text-subtle" dateTime={a.createdAt.toISOString()}>
                    {a.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </main>
    </>
  );
}
