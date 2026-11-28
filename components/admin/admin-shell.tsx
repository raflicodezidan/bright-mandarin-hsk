"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  FileText,
  GraduationCap,
  HardDrive,
  LayoutDashboard,
  Menu,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProfileRole } from "@/lib/auth";

type StaffRole = Exclude<ProfileRole, "student">;

const NAV_ITEMS: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact: boolean;
  roles: StaffRole[];
}[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
    roles: ["owner", "admin", "teacher"],
  },
  {
    href: "/admin/results",
    label: "Hasil",
    icon: ClipboardList,
    exact: false,
    roles: ["owner", "admin", "teacher"],
  },
  {
    href: "/admin/students",
    label: "Murid",
    icon: Users,
    exact: false,
    roles: ["owner", "admin", "teacher"],
  },
  {
    href: "/admin/tests",
    label: "Tes",
    icon: FileText,
    exact: false,
    roles: ["owner", "admin", "teacher"],
  },
  {
    href: "/admin/teachers",
    label: "Guru",
    icon: GraduationCap,
    exact: false,
    roles: ["owner", "admin"],
  },
  {
    href: "/admin/monitoring",
    label: "Pantau Nilai",
    icon: BarChart3,
    exact: false,
    roles: ["owner", "admin"],
  },
  {
    href: "/admin/storage",
    label: "Penyimpanan",
    icon: HardDrive,
    exact: false,
    roles: ["owner", "admin"],
  },
];

export type AdminShellProps = {
  children: React.ReactNode;
  role: StaffRole;
  userName?: string;
  email?: string;
  logout?: React.ReactNode;
};

function isActive(pathname: string, href: string, exact: boolean): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function initialsFor(name: string | undefined): string {
  if (!name) return "BM";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "BM";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function Navigation({
  pathname,
  role,
  onNavigate,
}: {
  pathname: string;
  role: StaffRole;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Menu utama" className="flex flex-col gap-1">
      <p className="mb-2 px-3 pt-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
        Menu utama
      </p>
      {NAV_ITEMS.filter((item) => item.roles.includes(role)).map(
        ({ href, label, icon: Icon, exact }) => {
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
        },
      )}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center">
      <Image
        src="/logo-bright-mandarin-horizontal.png"
        alt="Bright Mandarin"
        width={633}
        height={234}
        priority
        className="h-11 w-auto mix-blend-multiply sm:h-12"
      />
    </div>
  );
}

export function AdminShell({
  children,
  role,
  userName,
  email,
  logout,
}: AdminShellProps) {
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

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const currentPage = visibleItems.find(({ href, exact }) =>
    isActive(pathname, href, exact),
  );
  const pageTitle = currentPage?.label ?? "Tes";
  const roleLabel = role === "teacher" ? "Guru" : "Owner";

  const sidebarContent = (
    <>
      <div className="flex h-[72px] items-center border-b border-[#DCD9D0] bg-[#FAF9F5] px-3.5">
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
        <Navigation pathname={pathname} role={role} onNavigate={closeDrawer} />
      </div>
      <div className="border-t border-[#DCD9D0] p-3">
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center border border-[#DCD9D0] bg-[#F8F7F3] font-mono text-[10px] font-semibold text-[#18181B]">
            {initialsFor(userName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-4 text-[#18181B]">
              {userName ?? roleLabel}
            </p>
            <p className="truncate font-mono text-[10px] leading-3 text-[#71717A]">
              {email ? `${email} · ${roleLabel}` : roleLabel}
            </p>
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

      <header className="sticky top-0 z-10 flex h-[72px] items-center gap-3 border-b border-[#DCD9D0] bg-[#FAF9F5] px-4 sm:px-6">
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
