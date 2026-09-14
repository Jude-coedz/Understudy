import { Shell } from "@/components/shell";
import { continuityRisks } from "@/data/v2-demo";
import { IconAlert } from "@/components/icons";

export default function ContinuityPage() {
  return (
    <Shell>
      <div className="mx-auto max-w-[1120px] px-5 py-7 lg:px-8 lg:py-9">
        <div className="mb-8">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-subtle">Continuity</p>
          <h1 className="mt-1 text-[27px] font-semibold tracking-[-0.04em]">See where knowledge is concentrated before it becomes a handoff problem.</h1>
          <p className="mt-2 max-w-2xl text-[11px] leading-5 text-muted">
            This demo combines contribution concentration, documentation coverage, backup ownership, and unresolved knowledge gaps into a transparent risk view.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Critical dependencies", "2", "Need a transition plan"],
            ["Single-owner areas", "6", "Across Product + Engineering"],
            ["Unverified context", "14", "Claims need review"],
          ].map(([label, value, note]) => (
            <div key={label} className="border-y border-border py-4 sm:border-y-0 sm:border-l sm:pl-4 first:sm:border-l-0 first:sm:pl-0">
              <p className="text-[9.5px] text-subtle">{label}</p>
              <p className="mt-1.5 text-[26px] font-semibold tracking-[-0.04em]">{value}</p>
              <p className="mt-0.5 text-[9.5px] text-faint">{note}</p>
            </div>
          ))}
        </div>

        <section className="mt-8">
          <div className="mb-3">
            <h2 className="text-[13px] font-medium">Highest-risk ownership areas</h2>
            <p className="mt-0.5 text-[10px] text-subtle">Risk is explainable; Understudy shows the evidence behind every score.</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {continuityRisks.map((risk, index) => (
              <div key={risk.area} className={`grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_130px_80px] sm:items-center ${index > 0 ? "border-t border-border" : ""}`}>
                <div className="flex gap-3">
                  <IconAlert className={`mt-0.5 shrink-0 ${risk.score >= 80 ? "text-danger" : "text-warning"}`} />
                  <div>
                    <p className="text-[11.5px] font-medium">{risk.area}</p>
                    <p className="mt-1 text-[9.5px] leading-4 text-subtle">{risk.detail}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[9px] text-faint">Primary owner</p>
                  <p className="mt-1 text-[10px] text-muted">{risk.owner}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[17px] font-medium">{risk.score}</p>
                  <p className="text-[8.5px] text-faint">risk score</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}
