import * as React from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertTone = "info" | "success" | "warning" | "error";

const tones: Record<AlertTone, { wrapper: string; icon: React.ReactNode }> = {
  info: {
    wrapper: "border-primary bg-primary-subtle",
    icon: <Info size={16} strokeWidth={1.5} aria-hidden="true" />,
  },
  success: {
    wrapper: "border-success bg-success-subtle",
    icon: <CheckCircle2 size={16} strokeWidth={1.5} aria-hidden="true" />,
  },
  warning: {
    wrapper: "border-warning bg-warning-subtle",
    icon: <AlertTriangle size={16} strokeWidth={1.5} aria-hidden="true" />,
  },
  error: {
    wrapper: "border-accent bg-accent-subtle",
    icon: <AlertTriangle size={16} strokeWidth={1.5} aria-hidden="true" />,
  },
};

export type AlertProps = {
  tone?: AlertTone;
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export function Alert({ tone = "info", title, children, className }: AlertProps) {
  const config = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-sm border px-4 py-3 text-sm text-text",
        config.wrapper,
        className,
      )}
    >
      <span className="mt-0.5 shrink-0 text-text">{config.icon}</span>
      <div className="flex flex-col gap-1">
        {title ? <p className="font-medium">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}
