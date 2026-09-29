import { notFound } from "next/navigation";
import { ProductDemo } from "@/components/product-demo";
import { getTransition } from "@/data/v2-demo";

export default async function TransitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const transition = getTransition(id);

  if (!transition) notFound();

  return <ProductDemo transition={transition} />;
}
