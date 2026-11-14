import Link from "next/link";
import { cn } from "@/lib/utils";

export type PaginationProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  hrefForPage: (page: number) => string;
};

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  hrefForPage,
}: PaginationProps) {
  const first = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalItems);

  const linkClass =
    "inline-flex h-8 items-center rounded-sm border border-border-strong bg-surface px-3 text-xs font-medium text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  return (
    <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-text-muted">
        Menampilkan {first}-{last} dari {totalItems}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={hrefForPage(page - 1)} className={linkClass}>
            Sebelumnya
          </Link>
        ) : (
          <span className={cn(linkClass, "pointer-events-none opacity-50")}>
            Sebelumnya
          </span>
        )}
        <span className="px-2 text-xs text-text-muted">
          Halaman {page} dari {Math.max(totalPages, 1)}
        </span>
        {page < totalPages ? (
          <Link href={hrefForPage(page + 1)} className={linkClass}>
            Berikutnya
          </Link>
        ) : (
          <span className={cn(linkClass, "pointer-events-none opacity-50")}>
            Berikutnya
          </span>
        )}
      </div>
    </div>
  );
}
