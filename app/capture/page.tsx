import { Suspense } from "react";
import { CaptureView } from "@/components/capture-view";
import { Shell } from "@/components/shell";

export default function CapturePage() {
  return (
    <Shell>
      <Suspense fallback={<div className="p-6 text-muted">Loading capture…</div>}>
        <CaptureView />
      </Suspense>
    </Shell>
  );
}
