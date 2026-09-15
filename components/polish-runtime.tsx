"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type DatePickerState = {
  input: HTMLInputElement;
  rect: DOMRect;
  month: Date;
};

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toInputDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseInputDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function CalendarPopover({
  picker,
  onMonth,
  onSelect,
  onClear,
}: {
  picker: DatePickerState;
  onMonth: (month: Date) => void;
  onSelect: (date: Date) => void;
  onClear: () => void;
}) {
  const selected = parseInputDate(picker.input.value);
  const today = new Date();
  const year = picker.month.getFullYear();
  const monthIndex = picker.month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const mondayFirstOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: mondayFirstOffset + daysInMonth }, (_, index) => {
    if (index < mondayFirstOffset) return null;
    return new Date(year, monthIndex, index - mondayFirstOffset + 1, 12);
  });

  const minDate = picker.input.min ? parseInputDate(picker.input.min) : null;
  const maxDate = picker.input.max ? parseInputDate(picker.input.max) : null;
  const canSelect = (date: Date) =>
    (!minDate || date >= minDate) && (!maxDate || date <= maxDate);

  const width = Math.min(330, window.innerWidth - 24);
  const left = Math.min(
    Math.max(12, picker.rect.left),
    Math.max(12, window.innerWidth - width - 12),
  );
  const estimatedHeight = 390;
  const below = picker.rect.bottom + 8;
  const top =
    below + estimatedHeight <= window.innerHeight
      ? below
      : Math.max(12, picker.rect.top - estimatedHeight - 8);

  return createPortal(
    <div
      className="understudy-calendar fixed z-[100]"
      role="dialog"
      aria-modal="false"
      aria-label="Choose handoff date"
      style={{ top, left, width }}
    >
      <div className="understudy-calendar-header">
        <div>
          <p className="understudy-calendar-title">{MONTHS[monthIndex]} {year}</p>
          <p className="mt-0.5 text-xs text-subtle">Choose the target handoff date</p>
        </div>
        <div className="understudy-calendar-nav">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onMonth(new Date(year, monthIndex - 1, 1, 12))}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => onMonth(new Date(year, monthIndex + 1, 1, 12))}
          >
            →
          </button>
        </div>
      </div>

      <div className="understudy-calendar-grid">
        {WEEKDAYS.map((day, index) => (
          <div key={`${day}-${index}`} className="understudy-calendar-weekday" aria-hidden="true">
            {day}
          </div>
        ))}
        {cells.map((date, index) =>
          date ? (
            <button
              type="button"
              key={date.toISOString()}
              className="understudy-calendar-day disabled:cursor-not-allowed disabled:opacity-25"
              data-selected={selected ? sameDay(date, selected) : false}
              data-today={sameDay(date, today)}
              disabled={!canSelect(date)}
              aria-label={date.toLocaleDateString("en", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              onClick={() => onSelect(date)}
            >
              {date.getDate()}
            </button>
          ) : (
            <span key={`empty-${index}`} />
          ),
        )}
      </div>

      <div className="understudy-calendar-footer">
        <div className="understudy-calendar-shortcuts">
          <button type="button" onClick={() => onSelect(new Date())}>Today</button>
          <button
            type="button"
            onClick={() => {
              const date = new Date();
              date.setDate(date.getDate() + 14);
              onSelect(date);
            }}
          >
            2 weeks
          </button>
          <button
            type="button"
            onClick={() => {
              const date = new Date();
              date.setDate(date.getDate() + 30);
              onSelect(date);
            }}
          >
            30 days
          </button>
        </div>
        {picker.input.value && (
          <button type="button" className="understudy-calendar-clear" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function PolishRuntime() {
  const pathname = usePathname();
  const [picker, setPicker] = useState<DatePickerState | null>(null);
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    if (reducedMotion) return;
    const frame = window.requestAnimationFrame(() => {
      const main = document.querySelector("main");
      main?.animate(
        [
          { opacity: 0.72, transform: "translateY(5px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 320, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;

    const qualifiesForMotion = (element: HTMLElement) => {
      const classes = typeof element.className === "string" ? element.className : "";
      return (
        element.tagName === "SECTION" ||
        classes.includes("rounded-xl") ||
        classes.includes("sm:grid-cols-[40px") ||
        classes.includes("Focus set")
      );
    };

    const animate = (element: Element) => {
      if (!(element instanceof HTMLElement) || element.dataset.polishCard === "true") return;
      if (!qualifiesForMotion(element)) return;
      element.dataset.polishCard = "true";
      element.animate(
        [
          { opacity: 0, transform: "translateY(7px) scale(0.996)" },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        { duration: 330, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      );
    };

    document.querySelectorAll("section, [class*='rounded-xl'][class*='border']").forEach(animate);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          animate(node);
          node.querySelectorAll("section, [class*='rounded-xl'][class*='border']").forEach(animate);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [reducedMotion]);

  useEffect(() => {
    const openPicker = (input: HTMLInputElement) => {
      if (input.disabled || input.readOnly) return;
      const initial = parseInputDate(input.value) ?? new Date();
      setPicker({
        input,
        rect: input.getBoundingClientRect(),
        month: new Date(initial.getFullYear(), initial.getMonth(), 1, 12),
      });
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest(".understudy-calendar")) return;
      const input = target?.closest("input[type='date']");
      if (input instanceof HTMLInputElement) {
        event.preventDefault();
        openPicker(input);
        input.focus({ preventScroll: true });
        return;
      }
      setPicker(null);
    };

    const onFocus = (event: FocusEvent) => {
      const input = event.target;
      if (input instanceof HTMLInputElement && input.type === "date") openPicker(input);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPicker(null);
      if ((event.key === "Enter" || event.key === " ") && event.target instanceof HTMLInputElement && event.target.type === "date") {
        event.preventDefault();
        openPicker(event.target);
      }
    };

    const reposition = () => {
      setPicker((current) =>
        current
          ? { ...current, rect: current.input.getBoundingClientRect() }
          : current,
      );
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, []);

  if (!picker) return null;

  return (
    <CalendarPopover
      picker={picker}
      onMonth={(month) => setPicker((current) => current ? { ...current, month } : current)}
      onSelect={(date) => {
        setNativeInputValue(picker.input, toInputDate(date));
        picker.input.focus({ preventScroll: true });
        setPicker(null);
      }}
      onClear={() => {
        setNativeInputValue(picker.input, "");
        picker.input.focus({ preventScroll: true });
        setPicker(null);
      }}
    />
  );
}
