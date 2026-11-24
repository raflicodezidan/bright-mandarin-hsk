import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
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
import { CreateStudentDialog } from "@/components/admin/students/create-student-dialog";
import { StudentRowActions } from "@/components/admin/students/student-row-actions";
import { createClient } from "@/lib/supabase/server";
import { isOwnerRole, requireStaff } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Murid" };

const PAGE_SIZE = 25;
const NO_MATCH_ID = "00000000-0000-0000-0000-000000000000";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  teacher?: string;
  page?: string;
}>;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireStaff();
  const isOwner = isOwnerRole(profile.role);
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const status =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : "all";
  const teacherFilter =
    isOwner && params.teacher && /^[0-9a-f-]{36}$/.test(params.teacher)
      ? params.teacher
      : "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const supabase = await createClient();

  const [teachersResult, assignmentsResult] = await Promise.all([
    isOwner
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .eq("role", "teacher")
          .order("full_name")
      : Promise.resolve({ data: [] }),
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
  if (!isOwner) teacherNames.set(profile.id, profile.full_name);

  const assignments = assignmentsResult.data ?? [];
  const teacherByStudent = new Map(
    assignments.map((assignment) => [assignment.student_id, assignment.teacher_id]),
  );

  let query = supabase
    .from("profiles")
    .select("id, username, full_name, is_active, created_at", { count: "exact" })
    .eq("role", "student");

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,username.ilike.%${q}%`);
  }
  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false);
  if (teacherFilter) {
    const ids = assignments
      .filter((assignment) => assignment.teacher_id === teacherFilter)
      .map((assignment) => assignment.student_id);
    query =
      ids.length === 0
        ? query.eq("id", NO_MATCH_ID)
        : query.in("id", ids);
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const students = data ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function hrefForPage(nextPage: number): string {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (status !== "all") search.set("status", status);
    if (teacherFilter) search.set("teacher", teacherFilter);
    search.set("page", String(nextPage));
    return `/admin/students?${search.toString()}`;
  }

  return (
    <>
      <PageHeader
        title="Murid"
        description={
          isOwner
            ? "Kelola akun murid dan guru yang mengampu."
            : "Daftar murid yang Anda ampu."
        }
        actions={isOwner ? <CreateStudentDialog /> : undefined}
      />

      <div className="flex flex-col gap-4">
        <form
          method="get"
          className="flex flex-col gap-3 border-b border-[#DCD9D0] pb-4 sm:flex-row sm:flex-wrap sm:items-center"
        >
          <div className="w-full sm:max-w-xs">
            <label htmlFor="q" className="sr-only">
              Cari murid
            </label>
            <Input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Cari nama atau username"
            />
          </div>
          <div className="w-full sm:w-44">
            <label htmlFor="status" className="sr-only">
              Status
            </label>
            <Select id="status" name="status" defaultValue={status}>
              <option value="all">Semua status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </Select>
          </div>
          {isOwner ? (
            <div className="w-full sm:w-52">
              <label htmlFor="teacher" className="sr-only">
                Guru
              </label>
              <Select id="teacher" name="teacher" defaultValue={teacherFilter}>
                <option value="">Semua guru</option>
                {(teachersResult.data ?? []).map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.full_name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            <Button type="submit" variant="neutral">
              Terapkan
            </Button>
            {q || status !== "all" || teacherFilter ? (
              <Link
                href="/admin/students"
                className="text-xs text-text-muted underline-offset-2 hover:underline"
              >
                Hapus filter
              </Link>
            ) : null}
          </div>
        </form>

        {error ? (
          <EmptyState
            title="Gagal memuat data"
            description="Periksa koneksi, lalu muat ulang halaman."
          />
        ) : students.length === 0 ? (
          <EmptyState
            title={
              q || status !== "all" || teacherFilter
                ? "Tidak ada murid yang cocok"
                : "Belum ada murid"
            }
            description={
              q || status !== "all" || teacherFilter
                ? "Ubah kata kunci atau filter."
                : isOwner
                  ? "Tambahkan murid pertama untuk mulai."
                  : "Owner belum menugaskan murid kepada Anda."
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">No</TableHead>
                  <TableHead className="w-[24%] min-w-[150px] text-left">
                    Nama
                  </TableHead>
                  <TableHead className="w-[16%] text-left">Username</TableHead>
                  <TableHead className="w-[16%] text-left">Guru</TableHead>
                  <TableHead className="w-[10%]">Status</TableHead>
                  <TableHead className="w-[12%]">Dibuat</TableHead>
                  {isOwner ? (
                    <TableHead className="w-16">Aksi</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student, index) => {
                  const teacherId = teacherByStudent.get(student.id);
                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-mono text-xs tabular">
                        {(page - 1) * PAGE_SIZE + index + 1}
                      </TableCell>
                      <TableCell className="text-left font-medium">
                        {student.full_name}
                      </TableCell>
                      <TableCell className="text-left whitespace-nowrap font-mono text-xs tabular">
                        {student.username}
                      </TableCell>
                      <TableCell className="text-left text-text-muted">
                        {teacherId
                          ? teacherNames.get(teacherId) ?? "-"
                          : "Belum ditugaskan"}
                      </TableCell>
                      <TableCell>
                        {student.is_active ? (
                          <Badge tone="success">Aktif</Badge>
                        ) : (
                          <Badge tone="muted">Nonaktif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs tabular text-text-muted">
                        {formatDate(student.created_at)}
                      </TableCell>
                      {isOwner ? (
                        <TableCell>
                          <StudentRowActions
                            student={{
                              id: student.id,
                              fullName: student.full_name,
                              username: student.username,
                              isActive: student.is_active,
                            }}
                          />
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pagination
              page={page}
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
