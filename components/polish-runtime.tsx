"use client";

import { animate } from "motion";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
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

type ActionKind = "primary" | "secondary" | "ghost" | "nav" | "icon";

function actionClasses(element: HTMLElement) {
  return typeof element.className === "string" ? element.className : "";
}

function classifyAction(element: HTMLElement): ActionKind {
  const classes = actionClasses(element);
  const label = (element.textContent || "").trim();
  const ariaLabel = element.getAttribute("aria-label") || "";
  const compact = label.length <= 2 && Boolean(ariaLabel);

  if (
    compact ||
    classes.includes("rounded-full") && (classes.includes("h-8") || classes.includes("h-9") || classes.includes("h-10")) && label.length <= 2
  ) {
    return "icon";
  }

  if (element.closest("nav") || element.closest("aside")) return "nav";

  if (
    classes.includes("bg-accent") ||
    classes.includes("bg-foreground") ||
    classes.includes("primary-action-depth") ||
    classes.includes("text-white")
  ) {
    return "primary";
  }

  if (
    classes.includes("border") ||
    classes.includes("bg-card") ||
    classes.includes("bg-background")
  ) {
    return "secondary";
  }

  return "ghost";
}

function decorateAction(element: Element) {
  if (!(element instanceof HTMLElement)) return;
  if (element.closest(".understudy-calendar") || element.dataset.uiAction) return;
  element.dataset.uiAction = classifyAction(element);
  element.querySelectorAll("svg").forEach((icon) => icon.setAttribute("data-ui-icon", "true"));
}

function decorateActions(root: ParentNode = document) {
  root.querySelectorAll("button, a[href], [role='button']").forEach(decorateAction);
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
    <motion.div
      className="understudy-calendar fixed z-[100]"
      role="dialog"
      aria-modal="false"
      aria-label="Choose handoff date"
      style={{ top, left, width }}
      initial={{ opacity: 0, y: -6, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 430, damping: 34, mass: 0.7 }}
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
            <motion.button
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
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              onClick={() => onSelect(date)}
            >
              {date.getDate()}
            </motion.button>
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
    </motion.div>,
    document.body,
  );
}

export function PolishRuntime() {
  const [picker, setPicker] = useState<DatePickerState | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;

    const qualifiesForMotion = (element: HTMLElement) => {
      const classes = typeof element.className === "string" ? element.className : "";
      return (
        element.tagName === "SECTION" ||
        classes.includes("rounded-xl") ||
        classes.includes("sm:grid-cols-[40px") ||
        element.getAttribute("role") === "status" ||
        element.getAttribute("role") === "dialog"
      );
    };

    const animateSurface = (element: Element) => {
      if (!(element instanceof HTMLElement) || element.dataset.motionSurface === "true") return;
      if (!qualifiesForMotion(element)) return;
      element.dataset.motionSurface = "true";
      animate(
        element,
        {
          opacity: [0, 1],
          transform: ["translateY(9px) scale(0.995)", "translateY(0px) scale(1)"],
        },
        { duration: 0.34, ease: "easeOut" },
      );
    };

    document.querySelectorAll("section, [class*='rounded-xl'][class*='border'], [role='status'], [role='dialog']").forEach(animateSurface);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          animateSurface(node);
          node.querySelectorAll("section, [class*='rounded-xl'][class*='border'], [role='status'], [role='dialog']").forEach(animateSurface);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [reducedMotion]);

  useEffect(() => {
    decorateActions();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches("button, a[href], [role='button']")) decorateAction(node);
          decorateActions(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    if (reducedMotion) return () => observer.disconnect();

    const interactiveFromEvent = (event: Event) => {
      const target = event.target as Element | null;
      const interactive = target?.closest("[data-ui-action]");
      return interactive instanceof HTMLElement ? interactive : null;
    };

    const disabled = (element: HTMLElement) =>
      (element instanceof HTMLButtonElement && element.disabled) ||
      element.getAttribute("aria-disabled") === "true";

    const hoverIn = (event: PointerEvent) => {
      const element = interactiveFromEvent(event);
      if (!element || disabled(element)) return;
      const related = event.relatedTarget;
      if (related instanceof Node && element.contains(related)) return;

      const kind = element.dataset.uiAction as ActionKind;
      const target =
        kind === "nav"
          ? { x: 2.5, y: 0, scale: 1.006 }
          : kind === "icon"
            ? { x: 0, y: -1.5, scale: 1.045 }
            : { x: 0, y: -1.5, scale: 1.012 };

      animate(element, target, { type: "spring", stiffness: 430, damping: 30, mass: 0.65 });
      const icon = element.querySelector("[data-ui-icon='true']");
      if (icon instanceof SVGElement) {
        animate(icon, { scale: 1.09, rotate: kind === "primary" ? 3 : 1.5 }, { type: "spring", stiffness: 520, damping: 28 });
      }
    };

    const hoverOut = (event: PointerEvent) => {
      const element = interactiveFromEvent(event);
      if (!element) return;
      const related = event.relatedTarget;
      if (related instanceof Node && element.contains(related)) return;

      animate(element, { x: 0, y: 0, scale: 1 }, { type: "spring", stiffness: 430, damping: 31 });
      const icon = element.querySelector("[data-ui-icon='true']");
      if (icon instanceof SVGElement) {
        animate(icon, { scale: 1, rotate: 0 }, { type: "spring", stiffness: 500, damping: 30 });
      }
    };

    const press = (event: PointerEvent) => {
      const element = interactiveFromEvent(event);
      if (!element || disabled(element)) return;
      animate(element, { y: 0.5, scale: 0.972 }, { duration: 0.09, ease: "easeOut" });
    };

    const release = (event: PointerEvent) => {
      const element = interactiveFromEvent(event);
      if (!element || disabled(element)) return;
      animate(element, { y: 0, scale: 1 }, { type: "spring", stiffness: 560, damping: 31 });
    };

    document.addEventListener("pointerover", hoverIn, true);
    document.addEventListener("pointerout", hoverOut, true);
    document.addEventListener("pointerdown", press, true);
    document.addEventListener("pointerup", release, true);
    document.addEventListener("pointercancel", release, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("pointerover", hoverIn, true);
      document.removeEventListener("pointerout", hoverOut, true);
      document.removeEventListener("pointerdown", press, true);
      document.removeEventListener("pointerup", release, true);
      document.removeEventListener("pointercancel", release, true);
    };
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
