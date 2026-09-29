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
        className="understudy-route-frame min-h-screen bg-background"
        style={{ transformOrigin: "50% 0%" }}
        initial={reducedMotion ? false : { opacity: 0, y: 9, scale: 0.997, filter: "blur(5px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={reducedMotion
          ? { duration: 0 }
          : {
              opacity: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
              y: { type: "spring", stiffness: 330, damping: 34, mass: 0.8 },
              scale: { type: "spring", stiffness: 360, damping: 38, mass: 0.8 },
              filter: { duration: 0.26, ease: [0.16, 1, 0.3, 1] },
            }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
