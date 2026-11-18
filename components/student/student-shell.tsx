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
        <div className="mx-auto flex h-full max-w-4xl items-center justify-between px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              lang="zh-Hans"
              className="flex size-7 shrink-0 items-center justify-center rounded-[2px] bg-[#9E2A2B] text-sm font-semibold text-[#F8F7F3]"
            >
              明
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-bold leading-4 text-[#18181B]">
                Bright Mandarin
              </p>
              <p className="font-mono text-[10px] font-medium uppercase leading-3 tracking-[0.1em] text-[#71717A]">
                PORTAL MURID
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center">
            {userName ? (
              <div className="flex items-center gap-2.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-[2px] border border-[#DCD9D0] bg-[#ECEAE3] text-[#52525B]">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
                  </svg>
                </span>
                <span className="text-[13px] font-medium text-[#18181B]">
                  {userName}
                </span>
              </div>
            ) : null}

            {userName ? (
              <span
                aria-hidden="true"
                className="mx-3.5 h-5 w-[1px] bg-[#DCD9D0]"
              />
            ) : null}

            {logout}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
    </div>
  );
}