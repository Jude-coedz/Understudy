"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";

type Props = {
  size?: number;
  className?: string;
  subtle?: boolean;
};

export function UnderstudyMark({ size = 32, className = "", subtle = false }: Props) {
  const reducedMotion = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const gradientId = `understudy-liquid-${uid}`;
  const glowId = `understudy-glow-${uid}`;

  return (
    <motion.span
      className={`understudy-mark relative inline-grid shrink-0 place-items-center overflow-hidden rounded-[32%] ${className}`}
      style={{ width: size, height: size }}
      whileHover={reducedMotion ? undefined : { scale: 1.055, rotate: 1.5 }}
      whileTap={reducedMotion ? undefined : { scale: 0.94, rotate: -1 }}
      transition={{ type: "spring", stiffness: 430, damping: 28, mass: 0.65 }}
      aria-hidden
    >
      <motion.span
        className="pointer-events-none absolute inset-[-24%] rounded-full opacity-70 blur-lg"
        style={{
          background:
            "conic-gradient(from 90deg, rgba(105,190,210,.5), rgba(255,255,255,.15), rgba(65,110,135,.45), rgba(149,219,224,.4), rgba(105,190,210,.5))",
        }}
        animate={reducedMotion ? undefined : { rotate: [0, 360], scale: [1, 1.08, 1] }}
        transition={{ rotate: { duration: 11, repeat: Infinity, ease: "linear" }, scale: { duration: 4, repeat: Infinity, ease: "easeInOut" } }}
      />

      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        className="relative z-10 overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="5" y1="3" x2="27" y2="29" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#F8FEFF" />
            <stop offset="0.2" stopColor="#BFE8EF" />
            <stop offset="0.47" stopColor="#39758E" />
            <stop offset="0.72" stopColor="#8ED0DA" />
            <stop offset="1" stopColor="#EFFBFC" />
          </linearGradient>
          <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.15" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="0.3 0 0 0 0.15  0 0.7 0 0 0.35  0 0 0.85 0 0.45  0 0 0 .55 0"
              result="tint"
            />
            <feMerge>
              <feMergeNode in="tint" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="1" y="1" width="30" height="30" rx="10" fill="rgba(12,24,30,.94)" />
        <rect x="1.5" y="1.5" width="29" height="29" rx="9.5" fill="none" stroke="rgba(255,255,255,.2)" />

        <motion.path
          d="M9.15 8.35v9.12c0 4.05 2.54 6.45 6.85 6.45s6.85-2.4 6.85-6.45V8.35h-3.7v8.9c0 2.26-1.11 3.49-3.15 3.49s-3.15-1.23-3.15-3.49v-8.9h-3.7Z"
          fill={`url(#${gradientId})`}
          filter={`url(#${glowId})`}
          animate={reducedMotion ? undefined : { opacity: subtle ? [0.82, 1, 0.82] : [0.92, 1, 0.92] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>

      <motion.span
        className="pointer-events-none absolute left-[12%] top-[7%] h-[28%] w-[56%] rounded-full bg-white/30 blur-[6px]"
        animate={reducedMotion ? undefined : { x: ["-18%", "42%", "-18%"], opacity: [0.2, 0.55, 0.2] }}
        transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.span>
  );
}
