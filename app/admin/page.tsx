import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StorageCard } from "@/components/admin/storage-card";
import { EmptyState } from "@/components/ui/empty-state";
import { AttemptStatusBadge, Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { isOwnerRole, requireStaff } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { getStorageUsage } from "@/lib/storage-usage";
import { percentage, todayWibRange } from "@/lib/attempts";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const profile = await requireStaff();
  const isOwner = isOwnerRole(profile.role);
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
      isOwner ? getStorageUsage() : Promise.resolve(null),
    ]);

  const rows = latest.data ?? [];

  const teacherKpis = isOwner
    ? await supabase.rpc("owner_teacher_kpis")
    : null;
  const activeTeachers = (teacherKpis?.data ?? []).filter(
    (teacher) => teacher.is_active,
  );
  const attentionTeachers = [...activeTeachers]
    .filter((teacher) => teacher.weak_student_count > 0)
    .sort(
      (a, b) =>
        b.weak_student_count - a.weak_student_count ||
        Number(a.avg_percentage) - Number(b.avg_percentage),
    )
    .slice(0, 6);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          isOwner
            ? "Ringkasan kegiatan tes dan kinerja seluruh guru."
            : "Ringkasan kegiatan tes murid yang Anda ampu."
        }
      />

      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isOwner ? (
            <StatCard
              label="Murid aktif"
              value={students.count ?? 0}
              tone="success"
            />
          ) : (
            <StatCard
              label="Murid saya"
              value={students.count ?? 0}
              tone="success"
            />
          )}
          {isOwner ? (
            <StatCard
              label="Guru aktif"
              value={activeTeachers.length}
              tone="primary"
            />
          ) : (
            <StatCard
              label="Tes tersedia"
              value={openTests.count ?? 0}
              tone="primary"
            />
          )}
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

        {isOwner ? (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-text">
                  Perlu perhatian
                </h2>
                {attentionTeachers.length > 0 ? (
                  <Badge tone="accent">
                    {attentionTeachers.length} guru
                  </Badge>
                ) : null}
              </div>
              <Link
                href="/admin/teachers"
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                Kelola guru
              </Link>
            </div>

            {teacherKpis?.error ? (
              <EmptyState
                title="Data kinerja guru belum tersedia"
                description="Pastikan migrasi multi-guru sudah diterapkan ke database."
              />
            ) : attentionTeachers.length === 0 ? (
              <EmptyState
                title="Tidak ada guru yang perlu perhatian"
                description="Semua murid dengan nilai tercatat berada di atas 60."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%] min-w-[160px] text-left">
                      Guru
                    </TableHead>
                    <TableHead numeric className="w-[10%]">
                      Murid
                    </TableHead>
                    <TableHead numeric className="w-[10%]">
                      Selesai
                    </TableHead>
                    <TableHead numeric className="w-[10%]">
                      Rata-rata
                    </TableHead>
                    <TableHead numeric className="w-[12%]">
                      Nilai &lt; 60
                    </TableHead>
                    <TableHead className="w-[18%]">
                      Aktivitas terakhir
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attentionTeachers.map((teacher) => (
                    <TableRow key={teacher.teacher_id}>
                      <TableCell className="text-left font-medium">
                        <Link
                          href={`/admin/teachers/${teacher.teacher_id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {teacher.full_name}
                        </Link>
                      </TableCell>
                      <TableCell numeric>{teacher.student_count}</TableCell>
                      <TableCell numeric>{teacher.completed_count}</TableCell>
                      <TableCell numeric>
                        {teacher.completed_count > 0
                          ? `${Number(teacher.avg_percentage).toFixed(1)}%`
                          : "-"}
                      </TableCell>
                      <TableCell numeric>
                        <span className="font-semibold text-[#A62626]">
                          {teacher.weak_student_count}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs tabular text-text-muted">
                        {teacher.last_activity_at
                          ? formatDateTime(teacher.last_activity_at)
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        ) : null}

        {isOwner && storage ? (
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-text">Penyimpanan</h2>
            <StorageCard
              usage={storage.ok ? storage.data : null}
              error={storage.ok ? undefined : storage.error}
            />
          </section>
        ) : null}

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
                  <TableHead className="w-12">No</TableHead>
                  <TableHead className="w-[20%] min-w-[140px] text-left">
                    Murid
                  </TableHead>
                  <TableHead className="w-[28%] text-left">Tes</TableHead>
                  <TableHead numeric className="w-[10%]">
                    Benar
                  </TableHead>
                  <TableHead numeric className="w-[10%]">
                    Persentase
                  </TableHead>
                  <TableHead className="w-[10%]">Status</TableHead>
                  <TableHead className="w-[16%]">Selesai</TableHead>
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
                      <TableCell className="text-left">
                        <Link
                          href={`/admin/results/${row.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {row.profiles?.full_name ?? "-"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-left">
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
