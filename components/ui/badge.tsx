import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "neutral"
  | "muted"
  | "success"
  | "warning"
  | "accent"
  | "primary";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-text",
  muted: "bg-surface-muted text-text-muted",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  accent: "bg-accent-subtle text-accent",
  primary: "bg-primary-subtle text-primary",
};

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ tone = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export type TestStatus = "draft" | "open" | "closed" | "archived";
export type AttemptStatus = "in_progress" | "submitted" | "expired";

const testStatusMap: Record<TestStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  open: { label: "Dibuka", tone: "success" },
  closed: { label: "Ditutup", tone: "neutral" },
  archived: { label: "Diarsipkan", tone: "muted" },
};

const attemptStatusMap: Record<AttemptStatus, { label: string; tone: BadgeTone }> = {
  in_progress: { label: "Sedang berlangsung", tone: "warning" },
  submitted: { label: "Selesai", tone: "success" },
  expired: { label: "Waktu habis", tone: "accent" },
};

export function TestStatusBadge({ status }: { status: TestStatus }) {
  const item = testStatusMap[status];
  return <Badge tone={item.tone}>{item.label}</Badge>;
}

export function AttemptStatusBadge({ status }: { status: AttemptStatus }) {
  const item = attemptStatusMap[status];
  return <Badge tone={item.tone}>{item.label}</Badge>;
}
