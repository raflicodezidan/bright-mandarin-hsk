import { Card } from "@/components/ui/card";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StorageUsage } from "@/lib/storage-usage";

export type StorageCardProps = {
  usage: StorageUsage | null;
  error?: string;
};

export function StorageCard({ usage, error }: StorageCardProps) {
  if (!usage) {
    return (
      <Card>
        <p className="text-sm text-text-muted">
          {error ?? "Gagal memuat penggunaan penyimpanan. Coba muat ulang halaman."}
        </p>
      </Card>
    );
  }

  const percent = Math.min(100, Math.max(0, Math.round(usage.percentUsed)));
  const nearlyFull = percent >= 80;

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
            Media soal terpakai
          </p>
          <p className="font-mono text-[24px] font-semibold leading-8 tabular text-[#18181B]">
            {formatBytes(usage.usedBytes)}{" "}
            <span className="text-sm font-normal text-text-muted">
              dari {formatBytes(usage.quotaBytes)}
            </span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
            Sisa
          </p>
          <p className="font-mono text-[24px] font-semibold leading-8 tabular text-[#18181B]">
            {formatBytes(usage.remainingBytes)}
          </p>
        </div>
      </div>

      <div
        className="mt-4 h-2 w-full overflow-hidden rounded-[2px] bg-[#ECEAE3]"
        role="progressbar"
        aria-label="Penyimpanan terpakai"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}% terpakai`}
      >
        <div
          className={cn(
            "h-full rounded-[2px]",
            nearlyFull ? "bg-[#A62626]" : "bg-[#18181B]",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-text-muted">
        {percent}% dari kuota terpakai.
      </p>
      {nearlyFull ? (
        <p className="mt-1 text-xs text-[#A62626]">
          Penyimpanan hampir penuh. Hapus media soal yang tidak dipakai.
        </p>
      ) : null}
    </Card>
  );
}
