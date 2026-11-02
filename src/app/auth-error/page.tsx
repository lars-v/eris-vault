import Link from "next/link";

const MESSAGES: Record<string, string> = {
  GitHubEmailNotVerified:
    "GitHub hasn't verified the email on that account. Verify it in GitHub's email settings, then sign in again.",
  GoogleEmailNotVerified: "Google reports that email as unverified, so the sign-in was turned away.",
  OAuthAccountNotLinked:
    "That email already belongs to an account made with a different sign-in. Use the one you signed up with.",
  AccessDenied: "This sign-in was turned away.",
  Configuration: "Sign-in isn't fully set up on the server yet.",
};

export default async function AuthError({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message = (error && MESSAGES[error]) ?? "Something went wrong while signing in.";
  return (
    <main className="mx-auto flex min-h-screen max-w-[640px] flex-col justify-center gap-5 px-4 sm:px-8">
      <h1 className="font-display text-5xl text-parchment-2">Couldn&apos;t sign you in</h1>
      <p className="text-lg leading-relaxed text-muted">{message}</p>
      <Link href="/" className="text-moon underline-offset-4 hover:underline">
        Back to sign in
      </Link>
    </main>
  );
}
