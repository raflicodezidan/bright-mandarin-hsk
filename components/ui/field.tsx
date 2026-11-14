import * as React from "react";
import { cn } from "@/lib/utils";

export type FieldProps = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
};

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
}: FieldProps) {
  const messageId = htmlFor ? `${htmlFor}-message` : undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-accent">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={messageId} className="text-xs text-accent" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
