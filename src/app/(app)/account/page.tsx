import { eq } from "drizzle-orm";
import { enabledProviders, signIn } from "@/auth";
import { db } from "@/db";
import { accounts, users } from "@/db/schema";
import { Nav, SignOutButton } from "@/components/Nav";
import { Chip, PageHeader, Panel } from "@/components/ui";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Your account" };

const LABEL: Record<string, string> = { github: "GitHub", google: "Google" };

export default async function AccountPage() {
  const viewer = await requireUser();
  const [me] = await db.select({ email: users.email }).from(users).where(eq(users.id, viewer.userId)).limit(1);
  const linked = new Set(
    (await db.select({ provider: accounts.provider }).from(accounts).where(eq(accounts.userId, viewer.userId))).map(
      (a) => a.provider,
    ),
  );

  return (
    <>
      <Nav viewer={viewer} active="account" />
      <main className="mx-auto flex max-w-[880px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
        <PageHeader eyebrow={me?.email ?? "Signed in"} title="Your account">
          <SignOutButton />
        </PageHeader>

        <Panel title="Linked sign-ins">
          <p className="pb-2 text-sm leading-relaxed text-muted">
            Link both and either button on the sign-in page opens this same account, with the same characters
            {viewer.role === "admin" ? " and admin rights" : viewer.role === "gm" ? " and GM rights" : ""}.
          </p>
          {enabledProviders.map((provider) => (
            <div key={provider} className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#262920] py-3">
              <span className="text-[15px]">{LABEL[provider] ?? provider}</span>
              {linked.has(provider) ? (
                <Chip tone="lime">Linked</Chip>
              ) : (
                <form
                  action={async () => {
                    "use server";
                    await signIn(provider, { redirectTo: "/account" });
                  }}
                >
                  <button
                    type="submit"
                    className="min-h-11 rounded-lg border border-line-2 px-3.5 text-sm text-[#d6d2c2] hover:border-lime"
                  >
                    Link {LABEL[provider] ?? provider}
                  </button>
                </form>
              )}
            </div>
          ))}
          <p className="border-t border-[#262920] pt-3 text-xs leading-relaxed text-subtle">
            If that {enabledProviders.length > 1 ? "sign-in" : "account"} already made its own Eris Vault account, linking
            is refused. Ask the admin to merge the two first.
          </p>
        </Panel>
      </main>
    </>
  );
}
