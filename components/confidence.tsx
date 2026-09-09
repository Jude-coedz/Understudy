import type { Confidence } from "@/lib/types";

const FILLED: Record<Confidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function ConfidenceDots({
  value,
  label = true,
}: {
  value: Confidence;
  label?: boolean;
}) {
  const n = FILLED[value];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
      <span className="inline-flex gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${
              i < n ? "bg-accent" : "bg-border-strong"
            }`}
          />
        ))}
      </span>
      {label ? <span className="capitalize">{value}</span> : null}
    </span>
  );
}
