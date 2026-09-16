import Link from "next/link";
import { OnboardingFlowPolished } from "@/components/onboarding-flow-polished";

export default function Page() {
  return (
    <div className="relative">
      <Link
        href="/"
        className="fixed left-5 top-3 z-[60] hidden h-9 items-center rounded-lg border border-border bg-card/95 px-3 text-xs font-medium text-muted shadow-sm backdrop-blur hover:bg-card-hover sm:inline-flex"
      >
        My handoffs
      </Link>
      <OnboardingFlowPolished />
    </div>
  );
}
