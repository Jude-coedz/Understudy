"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function MotionRoute({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={pathname}
          className="min-h-screen"
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
          transition={reducedMotion
            ? { duration: 0 }
            : {
                opacity: { duration: 0.2, ease: "easeOut" },
                y: { type: "spring", stiffness: 390, damping: 38, mass: 0.8 },
              }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}
