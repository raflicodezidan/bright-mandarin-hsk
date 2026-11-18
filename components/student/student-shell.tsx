import * as React from "react";

export type StudentShellProps = {
  children: React.ReactNode;
  userName?: string;
  logout?: React.ReactNode;
};

export function StudentShell({ children, userName, logout }: StudentShellProps) {
  return (
    <div className="min-h-screen bg-[#F4F3EF] text-[#18181B]">
      <header className="sticky top-0 z-30 h-16 border-b border-[#DCD9D0] bg-[#F8F7F3]">
        <div className="flex h-full w-full items-center justify-between gap-4 px-6 sm:px-10 lg:px-14">
          <div className="flex min-w-0 items-center gap-3">
            <span
              lang="zh-Hans"
              className="font-cjk flex size-[30px] shrink-0 items-center justify-center rounded-[2px] bg-[#9E2A2B] text-sm font-semibold text-[#F8F7F3]"
            >
              明
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold leading-5 text-[#18181B]">
                Bright Mandarin
              </p>
              <p className="font-mono text-[10px] font-medium uppercase leading-3 tracking-[0.12em] text-[#71717A]">
                PORTAL MURID
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center">
            {userName ? (
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[2px] border border-[#DCD9D0] bg-[#ECEAE3] text-[#52525B]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
                  </svg>
                </span>
                <span className="max-w-40 truncate text-[14px] font-medium text-[#18181B]">
                  {userName}
                </span>
              </div>
            ) : null}
            {userName ? (
              <span aria-hidden="true" className="mx-4 h-5 w-[1px] bg-[#DCD9D0]" />
            ) : null}
            {logout}
          </div>
        </div>
      </header>
      <main className="w-full px-6 py-10 sm:px-10 lg:px-14">{children}</main>
    </div>
  );
}
