import * as React from "react";

export type StudentShellProps = {
  children: React.ReactNode;
  userName?: string;
  logout?: React.ReactNode;
};

export function StudentShell({ children, userName, logout }: StudentShellProps) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 h-14 border-b border-border bg-surface">
        <div className="mx-auto flex h-full w-full max-w-[800px] items-center justify-between gap-4 px-4 sm:px-6">
          <span className="text-sm font-semibold text-text">Bright Mandarin</span>
          <div className="flex items-center gap-3">
            {userName ? (
              <span className="max-w-40 truncate text-sm text-text-muted">
                {userName}
              </span>
            ) : null}
            {logout}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[800px] px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
