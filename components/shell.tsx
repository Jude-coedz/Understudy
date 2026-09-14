"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  IconAsk,
  IconContinuity,
  IconHome,
  IconPlug,
  IconTransition,
} from "./icons";

const PRIMARY_NAV = [
  { href: "/", label: "Overview", icon: IconHome },
  { href: "/transitions", label: "Transitions", icon: IconTransition },
  { href: "/continuity", label: "Continuity", icon: IconContinuity },
  { href: "/ask", label: "Ask Understudy", icon: IconAsk },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex h-14 items-center border-b border-border px-4">
          <Link href="/" className="flex items-center gap-2.5 font-medium tracking-[-0.02em]">
            <span className="flex h-6 w-6 items-center justify-center rounded-[7px] border border-[#777ee8]/35 bg-accent text-[11px] font-semibold text-white shadow-[inset_0_1px_rgba(255,255,255,0.12)]">
              U
            </span>
            <span className="text-[14px]">Understudy</span>
            <span className="rounded-[4px] border border-border bg-card px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-subtle">
              V2
            </span>
          </Link>
        </div>

        <div className="px-3 py-3">
          <button className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-card-hover">
            <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#1c1e22] text-[10px] font-semibold text-muted">
              N
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium">Northstar Labs</span>
              <span className="block truncate text-[10px] text-faint">Demo workspace</span>
            </span>
            <span className="text-[10px] text-faint">⌄</span>
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 px-2">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(item.href);
            const ItemIcon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[12.5px] transition-colors ${
                  active
                    ? "bg-card-hover text-foreground"
                    : "text-muted hover:bg-card hover:text-foreground"
                }`}
              >
                <ItemIcon className={active ? "text-[#aeb4ff]" : "text-subtle group-hover:text-muted"} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-2">
          <Link
            href="/integrations"
            className={`flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[12.5px] transition-colors ${
              isActive("/integrations")
                ? "bg-card-hover text-foreground"
                : "text-muted hover:bg-card hover:text-foreground"
            }`}
          >
            <IconPlug className="text-subtle" />
            Integrations
          </Link>
          <div className="mt-1 flex items-center gap-2.5 rounded-md px-2.5 py-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border-strong bg-surface-3 text-[9px] font-semibold text-muted">
              JA
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11.5px] font-medium">Jude Akede</p>
              <p className="truncate text-[10px] text-faint">Workspace admin</p>
            </div>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
        <Link href="/" className="flex items-center gap-2 text-[13px] font-medium">
          <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-accent text-[10px] font-semibold text-white">U</span>
          Understudy
        </Link>
        <Link href="/transitions" className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] text-muted">
          Transitions
        </Link>
      </header>

      <main className="min-h-screen md:ml-56">{children}</main>
    </div>
  );
}
