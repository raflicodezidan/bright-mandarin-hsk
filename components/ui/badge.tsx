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
  neutral: "bg-[#71717A]",
  muted: "bg-[#71717A]",
  success: "bg-[#1B5E3A]",
  warning: "bg-[#D97706]",
  accent: "bg-[#A62626]",
  primary: "bg-[#18181B]",
};

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({
  tone = "neutral",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-xs font-medium text-[#18181B]",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn("size-[6px] shrink-0 rounded-[1px]", tones[tone])}
      />
      {children}
    </span>
  );
}

export type TestStatus = "draft" | "open" | "closed" | "archived";
export type AttemptStatus = "in_progress" | "submitted" | "expired";

const testStatusMap: Record<TestStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "muted" },
  open: { label: "Dibuka", tone: "success" },
  closed: { label: "Ditutup", tone: "muted" },
  archived: { label: "Diarsipkan", tone: "muted" },
};

const attemptStatusMap: Record<AttemptStatus, { label: string; tone: BadgeTone }> = {
  in_progress: { label: "Proses", tone: "warning" },
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
