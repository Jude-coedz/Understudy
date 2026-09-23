"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { IconCheck, IconChevronRight } from "./icons";

export function UnderstudySelect({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  label: string;
}) {
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"up" | "down">("down");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (!open && root.current) {
            const rect = root.current.getBoundingClientRect();
            const estimatedMenuHeight = Math.min(options.length * 48 + 20, 280);
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            setPlacement(spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow ? "up" : "down");
          }
          setOpen((current) => !current);
        }}
        data-ui-action="secondary"
        className="flex h-12 w-full items-center justify-between rounded-xl border border-border bg-card px-3.5 text-left text-sm text-foreground"
      >
        <span className="truncate">{value}</span>
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 450, damping: 32 }}
          className="text-subtle"
        >
          <IconChevronRight />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            aria-label={label}
            initial={reducedMotion ? false : { opacity: 0, y: placement === "up" ? 6 : -6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: placement === "up" ? 4 : -4, scale: 0.99 }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 390, damping: 32 }}
            className={`absolute z-50 w-full overflow-hidden rounded-2xl border border-border-strong bg-card/95 p-1.5 shadow-xl backdrop-blur-xl ${
              placement === "up" ? "bottom-full mb-2" : "top-full mt-2"
            }`}
          >
            {options.map((option) => {
              const selected = option === value;
              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-ui-action="nav"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ${
                    selected ? "bg-accent-soft text-foreground" : "text-muted hover:bg-background"
                  }`}
                >
                  <span>{option}</span>
                  {selected && <IconCheck className="h-4 w-4 text-accent" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
