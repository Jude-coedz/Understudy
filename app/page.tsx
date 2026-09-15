import { CloudAccountControl } from "@/components/cloud-account-control";
import { OnboardingFlowPolished } from "@/components/onboarding-flow-polished";

export default function Page() {
  return (
    <>
      <div className="fixed right-5 top-3 z-50 hidden sm:block">
        <CloudAccountControl compact />
      </div>
      <OnboardingFlowPolished />
    </>
  );
}
