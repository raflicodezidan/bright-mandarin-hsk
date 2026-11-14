import { Card } from "@/components/ui/card";

export type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
};

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <Card className="flex flex-col gap-2 p-4 sm:p-6">
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p className="font-mono text-stat font-semibold tabular text-text">{value}</p>
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
    </Card>
  );
}
