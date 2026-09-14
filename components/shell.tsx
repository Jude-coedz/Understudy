"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getIdentity, type UnderstudyIdentity } from "@/lib/personal-workspace";
import {
  IconAsk,
  IconHome,
  IconPlug,
  IconTransition,
} from "./icons";

const PRIMARY_NAV = [
  { href: "/workspace", label: "Workspace", icon: IconHome },
  { href: "/transitions", label: "Demo transitions", icon: IconTransition },
  { href: "/ask", label: "Ask Understudy", icon: IconAsk },
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex h-14 items-center border-b border-border px-4">
          <Link href="/" className="flex items-center gap-2.5 font-medium tracking-[-0.02em]">
            <span className="flex h-6 w-6 items-center justify-center rounded-[7px] border border-[#777ee8]/35 bg-accent text-[11px] font-semibold text-white">
              U
            </span>
            <span className="text-[14px]">Understudy</span>
            <span className="rounded-[4px] border border-border bg-card px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.1em] text-subtle">
              Beta
            </span>
          </Link>
        </div>

        <div className="px-3 py-3">
          <div className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#1c1e22] text-[10px] font-semibold text-muted">
              {identity?.provider === "google" ? "G" : "P"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11.5px] font-medium">Personal workspace</span>
              <span className="block truncate text-[9.5px] text-faint">
                {identity?.provider === "google" ? identity.email || identity.name : "Browser-isolated trial"}
              </span>
            </span>
          </div>
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
                  active ? "bg-card-hover text-foreground" : "text-muted hover:bg-card hover:text-foreground"
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
              isActive("/integrations") ? "bg-card-hover text-foreground" : "text-muted hover:bg-card hover:text-foreground"
            }`}
          >
            <IconPlug className="text-subtle" />
            Integrations
          </Link>
          <div className="mt-1 flex items-center gap-2.5 rounded-md px-2.5 py-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border-strong bg-surface-3 text-[9px] font-semibold text-muted">
              {initials || "G"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11.5px] font-medium">{identity?.name || "Guest workspace"}</p>
              <p className="truncate text-[9.5px] text-faint">{identity?.provider === "google" ? "Google connected" : "Local trial"}</p>
            </div>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
        <Link href="/" className="flex items-center gap-2 text-[13px] font-medium">
          <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-accent text-[10px] font-semibold text-white">U</span>
          Understudy
        </Link>
        <Link href="/workspace" className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] text-muted">
          Workspace
        </Link>
      </header>

      <main className="min-h-screen md:ml-56">{children}</main>
    </div>
  );
}
