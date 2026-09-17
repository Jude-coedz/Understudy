"use client";

import { usePathname } from "next/navigation";
import { MotionConfig, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function MotionRoute({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        key={pathname}
        className="min-h-screen bg-background"
        initial={reducedMotion ? false : { opacity: 0.94, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion
          ? { duration: 0 }
          : {
              opacity: { duration: 0.14, ease: "easeOut" },
              y: { type: "spring", stiffness: 420, damping: 42, mass: 0.75 },
            }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
