import * as React from "react";

export type StudentShellProps = {
  children: React.ReactNode;
  userName?: string;
  logout?: React.ReactNode;
};

export function StudentShell({ children, userName, logout }: StudentShellProps) {
  return (
    <div className="min-h-screen bg-[#F4F3EF] text-[#18181B]">
      <header className="sticky top-0 z-30 h-14 border-b border-[#DCD9D0] bg-[#F8F7F3]">
        <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-between gap-4 px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span
              lang="zh-Hans"
              className="font-cjk flex size-7 shrink-0 items-center justify-center rounded-[2px] bg-[#9E2A2B] text-sm font-semibold text-[#F8F7F3]"
            >
              明
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-4 text-[#18181B]">
                Bright Mandarin
              </p>
              <p className="font-mono text-[10px] font-medium uppercase leading-3 tracking-[0.08em] text-[#71717A]">
                Portal Murid
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {userName ? (
              <span className="hidden max-w-40 truncate text-[13px] font-medium text-[#18181B] sm:inline">
                {userName}
              </span>
            ) : null}
            {userName ? (
              <span aria-hidden="true" className="hidden h-5 w-px bg-[#DCD9D0] sm:block" />
            ) : null}
            {logout}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-6 py-10">{children}</main>
    </div>
  );
}
