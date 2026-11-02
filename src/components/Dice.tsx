/** Shows each die face as rolled, so the table can check every result. */
export function DiceFaces({ faces, size = "md" }: { faces: number[]; size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-6 text-xs" : "size-8 text-sm";
  return (
    <span className="inline-flex gap-1" aria-label={`Dice: ${faces.join(", ")}`}>
      {faces.map((f, i) => (
        <span
          key={i}
          className={`inline-flex ${box} items-center justify-center rounded-md border border-line-2 bg-ink font-mono text-parchment`}
        >
          {f}
        </span>
      ))}
    </span>
  );
}

export const PURPOSE_LABEL: Record<string, string> = {
  abilities: "Ability scores",
  hp: "Hit points",
  gold: "Starting gold",
  "level-hp": "Hit points, new level",
  play: "Play",
};
