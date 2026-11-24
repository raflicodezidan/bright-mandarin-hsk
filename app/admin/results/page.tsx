import Link from "next/link";
import { Search } from "lucide-react";
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
import { isOwnerRole, requireStaff } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import {
  attemptDurationMinutes,
  percentage,
} from "@/lib/attempts";
import {
  hasActiveFilters,
  MAX_RESULT_QUERY_LENGTH,
  parseResultFilters,
  resultFilterQuery,
} from "@/lib/results-filter";
import { searchStudentIds } from "@/lib/results-search";
import { wibDayEnd, wibDayStart } from "@/lib/date";

export const metadata = { title: "Hasil" };

const PAGE_SIZE = 25;
const NO_MATCH_ID = "00000000-0000-0000-0000-000000000000";

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireStaff();
  const isOwner = isOwnerRole(profile.role);
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value);
  }
  const filters = parseResultFilters(params);
  const supabase = await createClient();

  const [studentsResult, testsResult, teachersResult, assignmentsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, username")
        .eq("role", "student")
        .order("full_name"),
      supabase
        .from("tests")
        .select("id, title, level")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "teacher"),
      supabase
        .from("teacher_students")
        .select("student_id, teacher_id")
        .is("ended_at", null),
    ]);

  const teacherNames = new Map(
    (teachersResult.data ?? []).map((teacher) => [
      teacher.id,
      teacher.full_name,
    ]),
  );
  const teacherByStudent = new Map(
    (assignmentsResult.data ?? []).map((assignment) => [
      assignment.student_id,
      assignment.teacher_id,
    ]),
  );

  const students = studentsResult.data ?? [];
  const tests = testsResult.data ?? [];
  const testIdsForLevel = filters.level
    ? tests.filter((test) => test.level === filters.level).map((test) => test.id)
    : null;
  const studentSearch = filters.q
    ? await searchStudentIds(supabase, filters.q)
    : null;
  const searchFailed = studentSearch?.failed ?? false;

  const from = (filters.page - 1) * PAGE_SIZE;

  let query = supabase
    .from("attempts")
    .select(
      "id, student_id, status, correct_count, total_count, listening_correct, listening_total, reading_correct, reading_total, started_at, submitted_at, profiles(full_name, username), tests(title, level)",
      { count: "exact" },
    );

  if (filters.studentId) query = query.eq("student_id", filters.studentId);
  if (filters.testId) query = query.eq("test_id", filters.testId);
  if (studentSearch) {
    query =
      studentSearch.ids.length === 0
        ? query.eq("student_id", NO_MATCH_ID)
        : query.in("student_id", studentSearch.ids);
  }
  if (testIdsForLevel) {
    if (testIdsForLevel.length === 0) {
      query = query.eq("test_id", NO_MATCH_ID);
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

  const emptyDescription = filters.q
    ? `Tidak ada pengerjaan yang cocok dengan "${filters.q}".`
    : hasActiveFilters(filters)
      ? "Ubah filter untuk melihat hasil lain."
      : "Hasil akan muncul setelah murid mengerjakan tes.";

  return (
    <>
      <PageHeader
        title="Hasil"
        description={
          isOwner
            ? "Semua pengerjaan tes murid dari seluruh guru."
            : "Pengerjaan tes murid yang Anda ampu."
        }
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
          className="flex flex-col gap-3 border-b border-[#DCD9D0] pb-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3 xl:col-span-2">
              <label htmlFor="q" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
                Cari murid
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="q"
                  name="q"
                  type="search"
                  defaultValue={filters.q ?? ""}
                  placeholder="Nama atau username"
                  maxLength={MAX_RESULT_QUERY_LENGTH}
                  autoComplete="off"
                  className="min-w-0 flex-1"
                />
                <Button
                  type="submit"
                  variant="neutral"
                  icon={<Search size={15} strokeWidth={1.5} aria-hidden="true" />}
                >
                  Cari
                </Button>
              </div>
            </div>
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
          </div>

          <div className="flex flex-wrap items-center gap-3">
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

        {error || searchFailed ? (
          <Alert tone="error">Gagal memuat hasil. Muat ulang halaman.</Alert>
        ) : attempts.length === 0 ? (
          <EmptyState
            title="Tidak ada pengerjaan"
            description={emptyDescription}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">No</TableHead>
                  <TableHead className="w-[14%] min-w-[140px]">Murid</TableHead>
                  {isOwner ? (
                    <TableHead className="w-[12%]">Guru</TableHead>
                  ) : null}
                  <TableHead className="w-[18%]">Tes</TableHead>
                  <TableHead className="w-[5%]">Level</TableHead>
                  <TableHead className="w-[10%]">Mulai</TableHead>
                  <TableHead className="w-[10%]">Selesai</TableHead>
                  <TableHead numeric className="w-[6%]">Durasi</TableHead>
                  <TableHead numeric className="w-[6%]">Benar</TableHead>
                  <TableHead numeric className="w-[6%]">Persen</TableHead>
                  <TableHead numeric className="w-[7%]">Listening</TableHead>
                  <TableHead numeric className="w-[7%]">Reading</TableHead>
                  <TableHead className="w-[7%]">Status</TableHead>
                  <TableHead className="w-16 text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((attempt, index) => {
                  const percent = percentage(
                    attempt.correct_count,
                    attempt.total_count,
                  );
                  const duration = attemptDurationMinutes(
                    attempt.started_at,
                    attempt.submitted_at,
                  );
                  const teacherId = teacherByStudent.get(attempt.student_id);
                  return (
                    <TableRow key={attempt.id}>
                      <TableCell className="font-mono text-xs tabular">
                        {(filters.page - 1) * PAGE_SIZE + index + 1}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/results/${attempt.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {attempt.profiles?.full_name ?? "-"}
                        </Link>
                      </TableCell>
                      {isOwner ? (
                        <TableCell className="text-text-muted">
                          {teacherId
                            ? teacherNames.get(teacherId) ?? "-"
                            : "Belum ditugaskan"}
                        </TableCell>
                      ) : null}
                      <TableCell>{attempt.tests?.title ?? "-"}</TableCell>
                      <TableCell>HSK {attempt.tests?.level ?? "-"}</TableCell>
                      <TableCell className="whitespace-nowrap text-text-muted">
                        {formatDateTime(attempt.started_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-text-muted">
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
                      <TableCell className="text-center">
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
