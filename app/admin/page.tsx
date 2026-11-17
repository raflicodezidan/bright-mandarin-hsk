import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StorageCard } from "@/components/admin/storage-card";
import { EmptyState } from "@/components/ui/empty-state";
import { AttemptStatusBadge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { getStorageUsage } from "@/lib/storage-usage";
import { percentage, todayWibRange } from "@/lib/attempts";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  await requireAdmin();
  const supabase = await createClient();
  const today = todayWibRange();

  await supabase.rpc("finalize_expired_attempts");

  const [students, openTests, inProgress, finishedToday, latest, storage] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "student")
        .eq("is_active", true),
      supabase
        .from("tests")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("attempts")
        .select("id", { count: "exact", head: true })
        .eq("status", "in_progress"),
      supabase
        .from("attempts")
        .select("id", { count: "exact", head: true })
        .in("status", ["submitted", "expired"])
        .gte("submitted_at", today.start)
        .lte("submitted_at", today.end),
      supabase
        .from("attempts")
        .select(
          "id, status, correct_count, total_count, started_at, submitted_at, profiles(full_name), tests(title, level)",
        )
        .order("started_at", { ascending: false })
        .limit(10),
      getStorageUsage(),
    ]);

  const rows = latest.data ?? [];

  return (
    <>
      <PageHeader title="Dashboard" description="Ringkasan kegiatan tes." />

      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Murid aktif"
            value={students.count ?? 0}
            tone="success"
          />
          <StatCard
            label="Tes terbuka"
            value={openTests.count ?? 0}
            tone="primary"
          />
          <StatCard
            label="Sedang mengerjakan"
            value={inProgress.count ?? 0}
            tone="warning"
          />
          <StatCard
            label="Selesai hari ini"
            value={finishedToday.count ?? 0}
            tone="accent"
          />
        </div>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-text">Penyimpanan</h2>
          <StorageCard
            usage={storage.ok ? storage.data : null}
            error={storage.ok ? undefined : storage.error}
          />
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-text">Hasil terbaru</h2>
            <Link
              href="/admin/results"
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              Lihat semua
            </Link>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title="Belum ada pengerjaan"
              description="Hasil akan muncul setelah murid mengerjakan tes."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                <TableHead>Murid</TableHead>
                  <TableHead>Tes</TableHead>
                  <TableHead numeric>Benar</TableHead>
                  <TableHead numeric>Persentase</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Selesai</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => {
                  const percent = percentage(row.correct_count, row.total_count);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs tabular">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/results/${row.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {row.profiles?.full_name ?? "-"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {row.tests
                          ? `HSK ${row.tests.level} · ${row.tests.title}`
                          : "-"}
                      </TableCell>
                      <TableCell numeric>
                        {row.correct_count ?? "-"} / {row.total_count ?? "-"}
                      </TableCell>
                      <TableCell numeric>
                        {percent === null ? "-" : `${percent}%`}
                      </TableCell>
                      <TableCell>
                        <AttemptStatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-text-muted">
                        {row.submitted_at ? formatDateTime(row.submitted_at) : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </>
  );
}
