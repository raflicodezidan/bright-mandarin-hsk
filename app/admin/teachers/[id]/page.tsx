import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, TestStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AssignStudentDialog } from "@/components/admin/teachers/assign-student-dialog";
import { TeacherRowActions } from "@/components/admin/teachers/teacher-row-actions";
import { UnassignStudentButton } from "@/components/admin/teachers/unassign-student-button";
import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Detail guru" };

type StudentRow = {
  id: string;
  fullName: string;
  username: string;
  isActive: boolean;
  assignedAt: string;
  attemptCount: number;
  completedCount: number;
  average: number | null;
};

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();
  const { id } = await params;
  const supabase = await createClient();

  const teacherResult = await supabase
    .from("profiles")
    .select("id, full_name, username, is_active")
    .eq("id", id)
    .eq("role", "teacher")
    .maybeSingle();

  const teacher = teacherResult.data;
  if (!teacher) notFound();

  const [assignmentsResult, allAssignmentsResult, studentsResult, teachersResult] =
    await Promise.all([
      supabase
        .from("teacher_students")
        .select("student_id, assigned_at")
        .eq("teacher_id", id)
        .is("ended_at", null)
        .order("assigned_at", { ascending: true }),
      supabase
        .from("teacher_students")
        .select("student_id, teacher_id")
        .is("ended_at", null),
      supabase
        .from("profiles")
        .select("id, full_name, username, is_active")
        .eq("role", "student")
        .eq("is_active", true)
        .order("full_name"),
      supabase.from("profiles").select("id, full_name").eq("role", "teacher"),
    ]);

  const assignments = assignmentsResult.data ?? [];
  const studentIds = assignments.map((assignment) => assignment.student_id);
  const students = studentsResult.data ?? [];
  const teacherNames = new Map(
    (teachersResult.data ?? []).map((item) => [item.id, item.full_name]),
  );

  const [studentProfilesResult, attemptsResult] = await Promise.all([
    studentIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, username, is_active")
          .in("id", studentIds)
      : Promise.resolve({ data: [] }),
    studentIds.length > 0
      ? supabase
          .from("attempts")
          .select("student_id, status, correct_count, total_count")
          .in("student_id", studentIds)
          .in("status", ["submitted", "expired"])
      : Promise.resolve({ data: [] }),
  ]);

  const profileById = new Map(
    (studentProfilesResult.data ?? []).map((profile) => [profile.id, profile]),
  );
  const attemptsByStudent = new Map<
    string,
    { correct: number; total: number }[]
  >();
  for (const attempt of attemptsResult.data ?? []) {
    if (!attempt.total_count || attempt.total_count === 0) continue;
    const list = attemptsByStudent.get(attempt.student_id) ?? [];
    list.push({
      correct: attempt.correct_count ?? 0,
      total: attempt.total_count,
    });
    attemptsByStudent.set(attempt.student_id, list);
  }

  const rows: StudentRow[] = assignments.flatMap((assignment) => {
    const profile = profileById.get(assignment.student_id);
    if (!profile) return [];
    const scores = attemptsByStudent.get(assignment.student_id) ?? [];
    const average =
      scores.length === 0
        ? null
        : scores.reduce(
            (sum, score) => sum + (score.correct / score.total) * 100,
            0,
          ) / scores.length;
    return [
      {
        id: profile.id,
        fullName: profile.full_name,
        username: profile.username,
        isActive: profile.is_active,
        assignedAt: assignment.assigned_at,
        attemptCount: scores.length,
        completedCount: scores.length,
        average,
      },
    ];
  });

  rows.sort((a, b) => a.fullName.localeCompare(b.fullName));

  const totalAttempts = [...attemptsByStudent.values()].reduce(
    (sum, scores) => sum + scores.length,
    0,
  );
  const averageValues = rows
    .map((row) => row.average)
    .filter((value): value is number => value !== null);
  const average =
    averageValues.length === 0
      ? null
      : averageValues.reduce((sum, value) => sum + value, 0) /
        averageValues.length;
  const weakCount = rows.filter(
    (row) => row.average !== null && row.average < 60,
  ).length;

  const assignedStudentIds = new Set(studentIds);
  const currentTeacherByStudent = new Map(
    (allAssignmentsResult.data ?? []).map((assignment) => [
      assignment.student_id,
      teacherNames.get(assignment.teacher_id) ?? null,
    ]),
  );
  const assignableStudents = students
    .filter((student) => !assignedStudentIds.has(student.id))
    .map((student) => ({
      id: student.id,
      fullName: student.full_name,
      username: student.username,
      currentTeacherName: currentTeacherByStudent.get(student.id) ?? null,
    }));

  const [ownedTestsResult, testAssignmentsResult] = await Promise.all([
    supabase
      .from("tests")
      .select("id, title, level, status, created_by, updated_at")
      .eq("created_by", teacher.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("test_assignments")
      .select("test_id")
      .eq("teacher_id", teacher.id),
  ]);

  const assignedTestIds = (testAssignmentsResult.data ?? []).map(
    (assignment) => assignment.test_id,
  );
  const assignedTestsResult =
    assignedTestIds.length > 0
      ? await supabase
          .from("tests")
          .select("id, title, level, status, created_by, updated_at")
          .in("id", assignedTestIds)
          .order("updated_at", { ascending: false })
      : { data: [] };

  const testById = new Map<
    string,
    {
      id: string;
      title: string;
      level: number;
      status: "draft" | "open" | "closed" | "archived";
      created_by: string | null;
    }
  >();
  for (const test of ownedTestsResult.data ?? []) testById.set(test.id, test);
  for (const test of assignedTestsResult.data ?? []) {
    if (!testById.has(test.id)) testById.set(test.id, test);
  }
  const tests = [...testById.values()];

  return (
    <>
      <PageHeader
        title={teacher.full_name}
        description={`@${teacher.username} · ${rows.length} murid diampu`}
        actions={
          <>
            <TeacherRowActions
              teacher={{
                id: teacher.id,
                fullName: teacher.full_name,
                username: teacher.username,
                isActive: teacher.is_active,
              }}
            />
            <LinkButton href="/admin/teachers" variant="secondary">
              <ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" />
              Kembali
            </LinkButton>
          </>
        }
      />

      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center gap-3">
          {teacher.is_active ? (
            <Badge tone="success">Aktif</Badge>
          ) : (
            <Badge tone="muted">Nonaktif</Badge>
          )}
          <span className="font-mono text-xs tabular text-text-muted">
            @{teacher.username}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Murid diampu" value={rows.length} tone="success" />
          <StatCard label="Pengerjaan selesai" value={totalAttempts} />
          <StatCard
            label="Rata-rata nilai"
            value={average === null ? "-" : `${Math.round(average)}%`}
          />
          <StatCard
            label="Murid di bawah 60"
            value={weakCount}
            tone={weakCount > 0 ? "accent" : "neutral"}
          />
        </div>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-text">
                Murid yang diampu
              </h2>
              <Badge tone="neutral">{rows.length} murid</Badge>
            </div>
            <AssignStudentDialog
              teacherId={teacher.id}
              students={assignableStudents}
            />
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title="Belum ada murid"
              description="Tugaskan murid kepada guru ini agar ia dapat memantau hasil belajar."
              action={
                <AssignStudentDialog
                  teacherId={teacher.id}
                  students={assignableStudents}
                />
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">No</TableHead>
                  <TableHead className="w-[24%] min-w-[150px] text-left">
                    Murid
                  </TableHead>
                  <TableHead className="w-[16%] text-left">Username</TableHead>
                  <TableHead className="w-[10%]">Status</TableHead>
                  <TableHead numeric className="w-[10%]">
                    Pengerjaan
                  </TableHead>
                  <TableHead numeric className="w-[10%]">
                    Rata-rata
                  </TableHead>
                  <TableHead className="w-[12%]">Sejak</TableHead>
                  <TableHead className="w-16">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs tabular">
                      {index + 1}
                    </TableCell>
                    <TableCell className="text-left font-medium">
                      {row.fullName}
                    </TableCell>
                    <TableCell className="text-left font-mono text-xs tabular text-text-muted">
                      {row.username}
                    </TableCell>
                    <TableCell>
                      {row.isActive ? (
                        <Badge tone="success">Aktif</Badge>
                      ) : (
                        <Badge tone="muted">Nonaktif</Badge>
                      )}
                    </TableCell>
                    <TableCell numeric>{row.completedCount}</TableCell>
                    <TableCell numeric>
                      {row.average === null ? (
                        "-"
                      ) : (
                        <span
                          className={
                            row.average < 60
                              ? "font-semibold text-[#A62626]"
                              : undefined
                          }
                        >
                          {Math.round(row.average)}%
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs tabular text-text-muted">
                      {formatDate(row.assignedAt)}
                    </TableCell>
                    <TableCell>
                      <UnassignStudentButton
                        studentId={row.id}
                        studentName={row.fullName}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-text">Tes</h2>
            <Badge tone="neutral">{tests.length} tes</Badge>
          </div>

          {tests.length === 0 ? (
            <EmptyState
              title="Belum ada tes"
              description="Tes milik guru atau yang ditugaskan kepadanya akan muncul di sini."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">No</TableHead>
                  <TableHead className="w-[46%] min-w-[200px] text-left">
                    Judul
                  </TableHead>
                  <TableHead numeric className="w-[10%]">
                    Level
                  </TableHead>
                  <TableHead className="w-[18%]">Sumber</TableHead>
                  <TableHead className="w-[16%]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tests.map((test, index) => (
                  <TableRow key={test.id}>
                    <TableCell className="font-mono text-xs tabular">
                      {index + 1}
                    </TableCell>
                    <TableCell className="text-left font-medium">
                      <Link
                        href={`/admin/tests/${test.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {test.title}
                      </Link>
                    </TableCell>
                    <TableCell numeric>HSK {test.level}</TableCell>
                    <TableCell>
                      {test.created_by === teacher.id ? (
                        <span className="text-xs text-text-muted">Milik guru</span>
                      ) : (
                        <span className="text-xs text-text-muted">
                          Ditugaskan
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <TestStatusBadge status={test.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </>
  );
}
