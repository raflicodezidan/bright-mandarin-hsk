import { cn } from "@/lib/utils";

export type StatCardTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "accent";

const TONE_CLASS: Record<StatCardTone, string> = {
  neutral: "border-[#DCD9D0] bg-[#F8F7F3]",
  primary: "border-[#C3D3E0] bg-[#E5EDF3]",
  success: "border-[#C5D8C9] bg-[#E6EFE8]",
  warning: "border-[#E0D1B7] bg-[#F3ECE0]",
  accent: "border-[#DEC4C0] bg-[#F2E6E4]",
};

export type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: StatCardTone;
};

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: StatCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-[3px] border p-4 sm:p-6",
        TONE_CLASS[tone],
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
        {label}
      </p>
      <p className="font-mono text-[30px] font-semibold leading-9 tabular text-[#18181B]">
        {value}
      </p>
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}
