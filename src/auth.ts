import { readFileSync } from "node:fs";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, profiles, sessions, users, verificationTokens, auditLog } from "@/db/schema";

/**
 * GitHub: any GitHub account may sign in, but only with an email GitHub has verified.
 * Auth.js's GitHub provider takes the email without checking `verified`, so we check here.
 * Without this, someone could sign up with another person's unverified address.
 */
async function githubEmailIsVerified(accessToken: string | undefined, email: string | null | undefined) {
  if (!accessToken || !email) return false;
  const res = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "eris-vault",
    },
    cache: "no-store",
  });
  if (!res.ok) return false;
  const list = (await res.json()) as { email: string; verified: boolean }[];
  return list.some((e) => e.verified && e.email.toLowerCase() === email.toLowerCase());
}

async function isBlocked(provider: string, providerAccountId: string, email: string | null | undefined) {
  const byAccount = await db
    .select({ status: profiles.status })
    .from(accounts)
    .innerJoin(profiles, eq(profiles.userId, accounts.userId))
    .where(and(eq(accounts.provider, provider), eq(accounts.providerAccountId, providerAccountId)))
    .limit(1);
  if (byAccount[0]?.status === "blocked") return true;
  if (!email) return false;
  const byEmail = await db
    .select({ status: profiles.status })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.email, email))
    .limit(1);
  return byEmail[0]?.status === "blocked";
}

const providers: Provider[] = [
  GitHub({
    clientId: process.env.AUTH_GITHUB_ID,
    clientSecret: process.env.AUTH_GITHUB_SECRET,
  }),
];

// Google is added once its keys exist on Railway. Google verifies emails, so a
// Google sign-in may join an existing account with the same email. GitHub may not.
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

/** AUTH_SECRET from the environment, else the one the server generated at boot (scripts/migrate.mjs). */
function authSecret(): string | undefined {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  try {
    return readFileSync(".auth-secret", "utf8").trim() || undefined;
  } catch {
    return undefined;
  }
}

export const enabledProviders = providers.map((p) => (typeof p === "function" ? p().id : p.id));

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers,
  secret: authSecret(),
  trustHost: true,
  session: { strategy: "database" },
  pages: { signIn: "/", error: "/auth-error" },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account) return false;
      if (await isBlocked(account.provider, account.providerAccountId, user.email)) {
        return "/blocked";
      }
      if (account.provider === "github") {
        const ok = await githubEmailIsVerified(account.access_token, user.email);
        if (!ok) return "/auth-error?error=GitHubEmailNotVerified";
      }
      if (account.provider === "google") {
        const verified = (profile as { email_verified?: boolean } | undefined)?.email_verified;
        if (!verified) return "/auth-error?error=GoogleEmailNotVerified";
      }
      return true;
    },
    session({ session, user }) {
      if (session.user && user) session.user.id = user.id;
      return session;
    },
  },
  events: {
    // Logged only when a sign-in is added to an account that already had one
    // (the Linked sign-ins page); a brand new account is logged by createUser.
    async linkAccount({ user, account }) {
      if (!user.id) return;
      const all = await db.select({ provider: accounts.provider }).from(accounts).where(eq(accounts.userId, user.id));
      if (all.length < 2) return;
      await db.insert(auditLog).values({
        actorId: user.id,
        actorRole: "system",
        targetUserId: user.id,
        action: "account.linked",
        after: { provider: account.provider },
      });
    },
    async createUser({ user }) {
      if (!user.id) return;
      await db.insert(profiles).values({ userId: user.id }).onConflictDoNothing();
      await db.insert(auditLog).values({
        actorId: user.id,
        actorRole: "system",
        targetUserId: user.id,
        action: "account.created",
        after: { name: user.name ?? null },
      });
    },
  },
});
