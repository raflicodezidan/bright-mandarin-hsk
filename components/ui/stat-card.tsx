import { Card } from "@/components/ui/card";

export type StatCardTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "accent";

const TONE_CLASS: Record<StatCardTone, string> = {
  neutral: "bg-surface",
  primary: "bg-primary-subtle",
  success: "bg-success-subtle",
  warning: "bg-warning-subtle",
  accent: "bg-accent-subtle",
};

export type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: StatCardTone;
};

export function StatCard({ label, value, hint, tone = "neutral" }: StatCardProps) {
  return (
    <Card className={`flex flex-col gap-2 p-4 sm:p-6 ${TONE_CLASS[tone]}`}>
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p className="font-mono text-stat font-semibold tabular text-text">{value}</p>
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
    </Card>
  );
}
