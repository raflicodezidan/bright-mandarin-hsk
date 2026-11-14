import * as React from "react";
import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 border-y border-[#DCD9D0] bg-transparent px-6 py-10",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-text">{title}</p>
        <p className="text-sm text-text-muted">{description}</p>
      </div>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
