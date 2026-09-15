"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getIdentity, type UnderstudyIdentity } from "@/lib/personal-workspace";
import {
  IconAsk,
  IconHome,
  IconPlug,
  IconSpark,
  IconTransition,
} from "./icons";

const PRIMARY_NAV = [
  { href: "/workspace", label: "Workspace", icon: IconHome },
  { href: "/recover-ai", label: "Recover AI context", icon: IconSpark },
  { href: "/ask", label: "Ask Understudy", icon: IconAsk },
  { href: "/transitions", label: "Demo transitions", icon: IconTransition },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [identity, setIdentity] = useState<UnderstudyIdentity | null>(null);

  useEffect(() => {
    setIdentity(getIdentity());
  }, []);

  const isActive = (href: string) => pathname.startsWith(href);
  const initials = (identity?.name || "Guest")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-sidebar/95 backdrop-blur-xl md:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/" className="flex items-center gap-3 font-medium tracking-[-0.025em]">
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-foreground text-[13px] font-semibold text-white shadow-sm">
              U
            </span>
            <span className="text-[15px]">Understudy</span>
            <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-subtle">
              Beta
            </span>
          </Link>
        </div>

        <div className="px-3 pb-4 pt-1">
          <div className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-sm">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-accent-soft text-[12px] font-semibold text-accent">
              {identity?.provider === "google" ? "G" : "P"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">Personal workspace</span>
              <span className="mt-0.5 block truncate text-[12px] text-faint">
                {identity?.provider === "google" ? identity.email || identity.name : "Browser-isolated trial"}
              </span>
            </span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(item.href);
            const ItemIcon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] ${
                  active
                    ? "bg-accent-soft font-medium text-foreground"
                    : "text-muted hover:bg-card hover:text-foreground"
                }`}
              >
                {active && <span className="absolute left-0 h-5 w-[3px] rounded-full bg-accent" />}
                <ItemIcon className={active ? "text-accent" : "text-subtle group-hover:text-muted"} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <Link
            href="/integrations"
            className={`flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] ${
              isActive("/integrations")
                ? "bg-accent-soft font-medium text-foreground"
                : "text-muted hover:bg-card hover:text-foreground"
            }`}
          >
            <IconPlug className={isActive("/integrations") ? "text-accent" : "text-subtle"} />
            Integrations
          </Link>
          <div className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-strong bg-card text-[11px] font-semibold text-muted shadow-sm">
              {initials || "G"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{identity?.name || "Guest workspace"}</p>
              <p className="mt-0.5 truncate text-[12px] text-faint">
                {identity?.provider === "google" ? "Google connected" : "Local trial"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl md:hidden">
        <Link href="/" className="flex items-center gap-2.5 text-[14px] font-medium">
          <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-foreground text-[11px] font-semibold text-white">U</span>
          Understudy
        </Link>
        <Link href="/workspace" className="rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-muted shadow-sm">
          Workspace
        </Link>
      </header>

      <main className="min-h-screen md:ml-60">{children}</main>
    </div>
  );
}
