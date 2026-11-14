"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  FileText,
  LayoutDashboard,
  Menu,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/students", label: "Murid", icon: Users, exact: false },
  { href: "/admin/tests", label: "Tes", icon: FileText, exact: false },
  { href: "/admin/results", label: "Hasil", icon: ClipboardList, exact: false },
] as const;

export type AdminShellProps = {
  children: React.ReactNode;
  userName?: string;
  logout?: React.ReactNode;
};

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Navigasi admin" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-sm px-3 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              active
                ? "bg-primary-subtle font-medium text-primary"
                : "text-text hover:bg-surface-muted",
            )}
          >
            <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children, userName, logout }: AdminShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const brand = (
    <div className="flex flex-col">
      <span className="text-sm font-semibold text-text">Bright Mandarin</span>
      <span className="text-xs text-text-muted">Admin</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface lg:flex">
        <div className="px-6 py-5">{brand}</div>
        <div className="flex-1 px-3 py-2">
          <NavList pathname={pathname} />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-4">
          <span className="truncate text-sm text-text">{userName ?? "Admin"}</span>
          {logout}
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
        {brand}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Buka menu"
          aria-expanded={drawerOpen}
          className="rounded-sm p-2 text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Menu size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </header>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[rgba(26,26,26,0.4)]"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu admin"
            className="relative flex h-full w-64 flex-col border-r border-border bg-surface shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
          >
            <div className="flex items-center justify-between px-4 py-3">
              {brand}
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Tutup menu"
                className="rounded-sm p-2 text-text-muted hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <X size={18} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 px-3 py-2">
              <NavList
                pathname={pathname}
                onNavigate={() => setDrawerOpen(false)}
              />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-4">
              <span className="truncate text-sm text-text">
                {userName ?? "Admin"}
              </span>
              {logout}
            </div>
          </div>
        </div>
      ) : null}

      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
