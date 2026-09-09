"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  IconAsk,
  IconCapture,
  IconCoverage,
  IconKnowledge,
} from "./icons";

const NAV = [
  { href: "/", label: "Knowledge", icon: IconKnowledge },
  { href: "/capture", label: "Capture", icon: IconCapture },
  { href: "/ask", label: "Ask", icon: IconAsk },
  { href: "/coverage", label: "Coverage", icon: IconCoverage },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 flex h-11 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-[13px] font-medium tracking-tight">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-[5px] bg-accent text-[10px] font-semibold text-white">
              U
            </span>
            Understudy
          </Link>
          <nav className="flex items-center gap-0.5">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] ${
                    active
                      ? "bg-accent-soft text-foreground"
                      : "text-muted hover:bg-card hover:text-foreground"
                  }`}
                >
                  <Icon />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <p className="hidden text-[11px] text-faint sm:block">
          FastTrack Dispatch · Lagos
        </p>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
