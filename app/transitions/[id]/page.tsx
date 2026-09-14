import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { TransitionWorkspace } from "@/components/transition-workspace";
import { getTransition } from "@/data/v2-demo";

export default async function TransitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const transition = getTransition(id);

  if (!transition) notFound();

  return (
    <Shell>
      <TransitionWorkspace transition={transition} />
    </Shell>
  );
}
