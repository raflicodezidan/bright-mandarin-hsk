import * as React from "react";
import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-[#DCD9D0] pb-5 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-[#18181B]">{title}</h1>
        {description ? (
          <p className="text-sm text-text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-3">{actions}</div>
      ) : null}
    </div>
  );
}
