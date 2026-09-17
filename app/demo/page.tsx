import { notFound } from "next/navigation";
import { ProductDemo } from "@/components/product-demo";
import { getTransition } from "@/data/v2-demo";

export default function DemoPage() {
  const transition = getTransition("maya-okafor");
  if (!transition) notFound();
  return <ProductDemo transition={transition} />;
}
