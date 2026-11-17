import { Panel } from "@/components/ui";
import { resolveScheme, SCHEME_KEYS, SCHEMES, STRIFE, type SchemeChoice, type SchemeKey } from "@/lib/schemes";
import { setColorScheme } from "./actions";

/** A little card drawn in a scheme's own colors: ground, text, a button and a chip. */
function Swatch({ scheme }: { scheme: SchemeKey }) {
  const t = resolveScheme(scheme);
  return (
    <span
      aria-hidden="true"
      className="flex flex-col gap-1.5 rounded-lg border p-2.5"
      style={{ background: t.surface, borderColor: t.line, color: t.parchment }}
    >
      <span className="text-[13px] leading-tight">Aa Hit points</span>
      <span className="flex items-center gap-1.5">
        <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: t.lime, color: t["lime-ink"] }}>
          Roll
        </span>
        <span className="size-2.5 rounded-full" style={{ background: t.amber }} />
        <span className="size-2.5 rounded-full" style={{ background: t.ember }} />
        <span className="size-2.5 rounded-full" style={{ background: t.moon }} />
      </span>
    </span>
  );
}

export function SchemePicker({ current }: { current: SchemeChoice }) {
  const card = (key: SchemeChoice, label: string, blurb: string, swatch: React.ReactNode) => (
    <button
      key={key}
      type="submit"
      name="scheme"
      value={key}
      aria-pressed={current === key}
      className={`flex flex-col gap-2 rounded-xl border-2 p-2 text-left hover:border-lime ${
        current === key ? "border-lime" : "border-line"
      }`}
    >
      {swatch}
      <span className="flex flex-col gap-0.5 px-0.5">
        <span className="text-sm font-semibold">
          {label}
          {current === key && <span className="ml-1.5 text-xs font-normal text-lime">In use</span>}
        </span>
        <span className="text-xs leading-snug text-muted">{blurb}</span>
      </span>
    </button>
  );

  // `id="colors"` is where the Colors link in the top bar (Nav) lands.
  return (
    <div id="colors" className="scroll-mt-4">
      <Panel title="Colors" aside="Saved to your account">
        <p className="text-sm leading-relaxed text-muted">
          Pick how the vault looks for you. Everyone else keeps their own choice.
        </p>
        <form action={setColorScheme} className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {SCHEME_KEYS.map((key) => card(key, SCHEMES[key].label, SCHEMES[key].blurb, <Swatch scheme={key} />))}
          {card(
            "strife",
            STRIFE.label,
            STRIFE.blurb,
            <span aria-hidden="true" className="grid h-full min-h-[58px] grid-cols-7 overflow-hidden rounded-lg border border-line">
              {SCHEME_KEYS.map((key) => (
                <span key={key} style={{ background: `linear-gradient(${resolveScheme(key).ink}, ${resolveScheme(key).lime})` }} />
              ))}
            </span>,
          )}
        </form>
      </Panel>
    </div>
  );
}
