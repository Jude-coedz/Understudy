import { notFound } from "next/navigation";
import { DemoHandoffWalkthrough } from "@/components/demo-handoff-walkthrough";
import { Shell } from "@/components/shell";
import { TransitionWorkspace } from "@/components/transition-workspace";
import { getTransition } from "@/data/v2-demo";

export default async function TransitionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { id } = await params;
  const { mode } = await searchParams;
  const transition = getTransition(id);

  if (!transition) notFound();

  if (id === "maya-okafor" && mode !== "workspace") {
    return <DemoHandoffWalkthrough transition={transition} />;
  }

  return (
    <Shell>
      <div className="border-b border-warning/20 bg-warning/5 px-5 py-2.5 text-center text-xs leading-5 text-muted">
        Demo workspace. The people, projects, evidence and legacy readiness fixtures on this screen are illustrative, not measurements from a real handoff.
      </div>
      <TransitionWorkspace transition={transition} />
    </Shell>
  );
}
