import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Alert } from "@/components/ui/alert";
import { AttemptStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResetAttemptButton } from "@/components/admin/results/reset-attempt-button";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import {
  attemptDurationMinutes,
  percentage,
} from "@/lib/attempts";
import {
  hasActiveFilters,
  parseResultFilters,
  resultFilterQuery,
} from "@/lib/results-filter";
import { wibDayEnd, wibDayStart } from "@/lib/date";

export const metadata = { title: "Hasil" };

const PAGE_SIZE = 25;

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value);
  }
  const filters = parseResultFilters(params);
  const supabase = await createClient();

  const [studentsResult, testsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, username")
      .eq("role", "student")
      .order("full_name"),
    supabase
      .from("tests")
      .select("id, title, level")
      .order("created_at", { ascending: false }),
  ]);

  const students = studentsResult.data ?? [];
  const tests = testsResult.data ?? [];
  const testIdsForLevel = filters.level
    ? tests.filter((test) => test.level === filters.level).map((test) => test.id)
    : null;

  const from = (filters.page - 1) * PAGE_SIZE;

  let query = supabase
    .from("attempts")
    .select(
      "id, status, correct_count, total_count, listening_correct, listening_total, reading_correct, reading_total, started_at, submitted_at, profiles(full_name, username), tests(title, level)",
      { count: "exact" },
    );

  if (filters.studentId) query = query.eq("student_id", filters.studentId);
  if (filters.testId) query = query.eq("test_id", filters.testId);
  if (testIdsForLevel) {
    if (testIdsForLevel.length === 0) {
      query = query.eq("test_id", "00000000-0000-0000-0000-000000000000");
    } else {
      query = query.in("test_id", testIdsForLevel);
    }
  }
  if (filters.status) query = query.eq("status", filters.status);
  const fromIso = filters.from ? wibDayStart(filters.from) : null;
  const toIso = filters.to ? wibDayEnd(filters.to) : null;
  if (fromIso) query = query.gte("submitted_at", fromIso);
  if (toIso) query = query.lte("submitted_at", toIso);

  const { data, count, error } = await query
    .order("started_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const attempts = data ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function hrefForPage(nextPage: number): string {
    const next = resultFilterQuery(filters);
    next.set("page", String(nextPage));
    return `/admin/results?${next.toString()}`;
  }

  const exportQuery = resultFilterQuery(filters);

  return (
    <>
      <PageHeader
        title="Hasil"
        description="Semua pengerjaan tes murid."
        actions={
          <LinkButton
            href={`/admin/results/export?${exportQuery.toString()}`}
            variant="secondary"
          >
            Export CSV
          </LinkButton>
        }
      />

      <div className="flex flex-col gap-4">
        <form
          method="get"
          className="grid grid-cols-1 gap-3 border-b border-[#DCD9D0] pb-4 sm:grid-cols-2 lg:grid-cols-6"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="student" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
              Murid
            </label>
            <Select id="student" name="student" defaultValue={filters.studentId ?? ""}>
              <option value="">Semua murid</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.full_name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="test" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
              Tes
            </label>
            <Select id="test" name="test" defaultValue={filters.testId ?? ""}>
              <option value="">Semua tes</option>
              {tests.map((test) => (
                <option key={test.id} value={test.id}>
                  HSK {test.level} · {test.title}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="level" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
              Level
            </label>
            <Select
              id="level"
              name="level"
              defaultValue={filters.level ? String(filters.level) : ""}
            >
              <option value="">Semua</option>
              {[1, 2, 3, 4, 5, 6].map((level) => (
                <option key={level} value={level}>
                  HSK {level}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="from" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
              Dari tanggal
            </label>
            <Input id="from" name="from" type="date" defaultValue={filters.from ?? ""} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="to" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
              Sampai tanggal
            </label>
            <Input id="to" name="to" type="date" defaultValue={filters.to ?? ""} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="status" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
              Status
            </label>
            <Select id="status" name="status" defaultValue={filters.status ?? ""}>
              <option value="">Semua status</option>
              <option value="in_progress">Sedang berlangsung</option>
              <option value="submitted">Selesai</option>
              <option value="expired">Waktu habis</option>
            </Select>
          </div>
          <div className="col-span-full flex items-center gap-3">
            <Button type="submit" variant="neutral">
              Terapkan
            </Button>
            {hasActiveFilters(filters) ? (
              <Link
                href="/admin/results"
                className="text-xs text-text-muted underline-offset-2 hover:underline"
              >
                Hapus filter
              </Link>
            ) : null}
          </div>
        </form>

        {error ? (
          <Alert tone="error">Gagal memuat hasil. Muat ulang halaman.</Alert>
        ) : attempts.length === 0 ? (
          <EmptyState
            title="Tidak ada pengerjaan"
            description={
              hasActiveFilters(filters)
                ? "Ubah filter untuk melihat hasil lain."
                : "Hasil akan muncul setelah murid mengerjakan tes."
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Murid</TableHead>
                  <TableHead>Tes</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Mulai</TableHead>
                  <TableHead>Selesai</TableHead>
                  <TableHead numeric>Durasi</TableHead>
                  <TableHead numeric>Benar</TableHead>
                  <TableHead numeric>Persen</TableHead>
                  <TableHead numeric>Listening</TableHead>
                  <TableHead numeric>Reading</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((attempt) => {
                  const percent = percentage(
                    attempt.correct_count,
                    attempt.total_count,
                  );
                  const duration = attemptDurationMinutes(
                    attempt.started_at,
                    attempt.submitted_at,
                  );
                  return (
                    <TableRow key={attempt.id}>
                      <TableCell>
                        <Link
                          href={`/admin/results/${attempt.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {attempt.profiles?.full_name ?? "-"}
                        </Link>
                      </TableCell>
                      <TableCell>{attempt.tests?.title ?? "-"}</TableCell>
                      <TableCell>HSK {attempt.tests?.level ?? "-"}</TableCell>
                      <TableCell className="text-text-muted">
                        {formatDateTime(attempt.started_at)}
                      </TableCell>
                      <TableCell className="text-text-muted">
                        {attempt.submitted_at
                          ? formatDateTime(attempt.submitted_at)
                          : "-"}
                      </TableCell>
                      <TableCell numeric>
                        {duration === null ? "-" : `${duration} mnt`}
                      </TableCell>
                      <TableCell numeric>
                        {attempt.correct_count ?? "-"} /{" "}
                        {attempt.total_count ?? "-"}
                      </TableCell>
                      <TableCell numeric>
                        {percent === null ? "-" : `${percent}%`}
                      </TableCell>
                      <TableCell numeric>
                        {attempt.listening_correct ?? "-"} /{" "}
                        {attempt.listening_total ?? "-"}
                      </TableCell>
                      <TableCell numeric>
                        {attempt.reading_correct ?? "-"} /{" "}
                        {attempt.reading_total ?? "-"}
                      </TableCell>
                      <TableCell>
                        <AttemptStatusBadge status={attempt.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <ResetAttemptButton
                          attemptId={attempt.id}
                          studentName={attempt.profiles?.full_name ?? "murid"}
                          testTitle={attempt.tests?.title ?? "tes"}
                          compact
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pagination
              page={filters.page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={PAGE_SIZE}
              hrefForPage={hrefForPage}
            />
          </>
        )}
      </div>
    </>
  );
}
