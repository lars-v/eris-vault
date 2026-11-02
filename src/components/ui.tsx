import type { ReactNode } from "react";

export function Chip({ tone = "plain", children }: { tone?: "lime" | "amber" | "moon" | "ember" | "plain"; children: ReactNode }) {
  const styles = {
    lime: "bg-[#222c17] border-[#4b5e2a] text-lime",
    amber: "bg-[#2a2113] border-[#5e4720] text-amber",
    moon: "bg-[#18202e] border-[#34496b] text-moon",
    ember: "bg-[#2e1a15] border-[#5c3328] text-ember",
    plain: "border-line-2 text-muted",
  }[tone];
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles}`}>{children}</span>;
}

export function Panel({ title, aside, children, className = "" }: { title?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 ${className}`}>
      {(title || aside) && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {title && <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-subtle">{title}</h2>}
          {aside && <span className="text-xs text-subtle">{aside}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ eyebrow, title, children, tone = "subtle" }: { eyebrow: string; title: string; children?: ReactNode; tone?: "subtle" | "amber" | "moon" }) {
  const eyebrowColor = { subtle: "text-subtle", amber: "text-amber", moon: "text-moon" }[tone];
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        <div className={`text-[13px] font-semibold uppercase tracking-[0.14em] ${eyebrowColor}`}>{eyebrow}</div>
        <h1 className="font-display text-5xl leading-none text-parchment-2">{title}</h1>
      </div>
      {children}
    </div>
  );
}
