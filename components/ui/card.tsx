import * as React from "react";
import { cn } from "@/lib/utils";

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  title?: string;
  description?: string;
  flush?: boolean;
  divided?: boolean;
};

export function Card({
  title,
  description,
  flush = false,
  divided = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-surface",
        !flush && "p-6",
        className,
      )}
      {...props}
    >
      {title ? (
        <div
          className={cn(
            "flex flex-col gap-1",
            divided && "border-b border-border pb-4",
            !flush && "mb-4",
          )}
        >
          <h3 className="text-base font-semibold text-text">{title}</h3>
          {description ? (
            <p className="text-xs text-text-muted">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
