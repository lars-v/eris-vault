export default function Blocked() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[640px] flex-col justify-center gap-5 px-4 sm:px-8">
      <h1 className="font-display text-5xl text-parchment-2">This account is blocked</h1>
      <p className="text-lg leading-relaxed text-muted">
        The game master or admin has blocked this account. If that seems wrong, ask them at the table.
      </p>
    </main>
  );
}
