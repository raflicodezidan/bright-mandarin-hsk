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
  { href: "/admin/results", label: "Hasil", icon: ClipboardList, exact: false },
  { href: "/admin/students", label: "Murid", icon: Users, exact: false },
  { href: "/admin/tests", label: "Tes", icon: FileText, exact: false },
] as const;

export type AdminShellProps = {
  children: React.ReactNode;
  userName?: string;
  email?: string;
  logout?: React.ReactNode;
};

function isActive(pathname: string, href: string, exact: boolean): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function Navigation({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Menu utama" className="flex flex-col gap-1">
      <p className="mb-2 px-3 pt-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
        Menu utama
      </p>
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(pathname, href, exact);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-9 items-center gap-3 rounded-[2px] px-3 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              active
                ? "bg-[#E2DFD5] font-semibold text-[#18181B] before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-[#9E2A2B]"
                : "text-[#52525B] hover:bg-[#E2DFD5] hover:text-[#18181B]",
            )}
          >
            <Icon size={15} strokeWidth={1.6} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-[2px] bg-[#9E2A2B] font-cjk text-sm font-semibold text-[#F8F7F3]" lang="zh-Hans">
        明
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-4 text-[#18181B]">Bright Mandarin</p>
        <p className="font-mono text-[9px] font-medium leading-3 tracking-[0.08em] text-[#71717A]">
          ADMIN PORTAL
        </p>
      </div>
    </div>
  );
}

export function AdminShell({ children, userName, email, logout }: AdminShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const closeDrawer = React.useCallback(() => setDrawerOpen(false), []);

  React.useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeDrawer();
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen, closeDrawer]);

  const currentPage = NAV_ITEMS.find(({ href, exact }) =>
    isActive(pathname, href, exact),
  );
  const pageTitle = currentPage?.label ?? "Tes";

  const sidebarContent = (
    <>
      <div className="flex h-[52px] items-center border-b border-[#DCD9D0] px-3">
        <Brand />
        <button
          type="button"
          onClick={closeDrawer}
          aria-label="Tutup menu"
          className="ml-auto rounded-[2px] p-2 text-[#52525B] hover:bg-[#F8F7F3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#18181B] lg:hidden"
        >
          <X size={17} aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 px-2">
        <Navigation pathname={pathname} onNavigate={closeDrawer} />
      </div>
      <div className="border-t border-[#DCD9D0] p-3">
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center border border-[#DCD9D0] bg-[#F8F7F3] font-mono text-[10px] font-semibold text-[#18181B]">
            AD
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-4 text-[#18181B]">
              {userName ?? "Administrator"}
            </p>
            {email ? (
              <p className="truncate font-mono text-[10px] leading-3 text-[#71717A]">
                {email}
              </p>
            ) : null}
          </div>
        </div>
        <div className="[&_button]:w-full">{logout}</div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F4F3EF] text-[#18181B] lg:pl-[240px]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[240px] flex-col border-r border-[#DCD9D0] bg-[#ECEAE3] lg:flex">
        {sidebarContent}
      </aside>

      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-[#DCD9D0] bg-[#F8F7F3] px-4 sm:px-6">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Buka menu"
          aria-expanded={drawerOpen}
          className="rounded-[2px] p-2 text-[#18181B] hover:bg-[#ECEAE3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#18181B] lg:hidden"
        >
          <Menu size={18} aria-hidden="true" />
        </button>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-xs">
          <span className="hidden text-[#71717A] sm:inline">Bright Mandarin</span>
          <span className="hidden text-[#A1A1AA] sm:inline">/</span>
          <span className="truncate font-semibold text-[#18181B]">{pageTitle}</span>
        </nav>
        <div className="ml-auto lg:hidden">{logout}</div>
      </header>

      {drawerOpen ? (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            className="absolute inset-0 h-full w-full bg-black/20"
            onClick={closeDrawer}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu admin"
            className="relative flex h-full w-[240px] max-w-[85vw] flex-col border-r border-[#DCD9D0] bg-[#F8F7F3]"
          >
            {sidebarContent}
          </aside>
        </div>
      ) : null}

      <main className="w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
