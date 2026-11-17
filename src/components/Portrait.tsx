/** Up to two capitals from the name, shown when a character has no picture. */
export function initials(name: string) {
  return name
    .split(" ")
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
}

/**
 * The oval medallion on the sheet header and party cards: the character's
 * picture when there is one, otherwise their initials.
 */
export function Portrait({ name, src, size }: { name: string; src: string | null; size: "card" | "sheet" }) {
  const shape =
    size === "sheet"
      ? "h-20 w-16 border-2 text-2xl sm:h-32 sm:w-26 sm:text-4xl"
      : "h-20 w-16 border-[1.5px] text-2xl";
  return (
    <div className={`flex flex-none items-center justify-center overflow-hidden rounded-[50%] border-lime bg-ink font-display text-lime ${shape}`}>
      {src ? (
        // Served by /api/portraits behind sign-in, so next/image's optimizer can't fetch it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Picture of ${name}`} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </div>
  );
}
