"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type Props = {
  term: string;
  children: ReactNode;
};

export function Explain({ term, children }: Props) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = 280;
    const left = Math.min(
      Math.max(8, r.left),
      window.innerWidth - width - 8,
    );
    const top = r.bottom + 6;
    setPos({ top, left });
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const close = useCallback(() => {
    cancelClose();
    setOpen(false);
    setPinned(false);
  }, [cancelClose]);

  const scheduleClose = useCallback(() => {
    if (pinned) return;
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
    }, 160);
  }, [pinned, cancelClose]);

  useEffect(() => {
    return () => cancelClose();
  }, [cancelClose]);

  useEffect(() => {
    if (!open) return;
    place();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      close();
    };
    const onScroll = () => place();
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, close, place]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="explain-term bg-transparent p-0 text-inherit"
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={() => {
          cancelClose();
          place();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        onFocus={() => {
          cancelClose();
          place();
          setOpen(true);
        }}
        onBlur={scheduleClose}
        onClick={(e) => {
          e.preventDefault();
          cancelClose();
          place();
          setPinned(true);
          setOpen(true);
        }}
      >
        {term}
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            id={id}
            role="tooltip"
            className="fixed z-50 w-[280px] rounded-md border border-border bg-card px-3 py-2.5 text-[12px] leading-relaxed text-foreground shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
            style={{ top: pos.top, left: pos.left }}
            onMouseEnter={() => {
              cancelClose();
              setOpen(true);
            }}
            onMouseLeave={scheduleClose}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
