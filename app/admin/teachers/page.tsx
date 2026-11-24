import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateTeacherDialog } from "@/components/admin/teachers/create-teacher-dialog";
import { TeacherRowActions } from "@/components/admin/teachers/teacher-row-actions";
import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Guru" };

export default async function TeachersPage() {
  await requireOwner();
  const supabase = await createClient();

  const [kpiResult, studentsResult, assignmentsResult] = await Promise.all([
    supabase.rpc("owner_teacher_kpis"),
    supabase
      .from("profiles")
      .select("id")
      .eq("role", "student")
      .eq("is_active", true),
    supabase
      .from("teacher_students")
      .select("student_id")
      .is("ended_at", null),
  ]);

  const teachers = kpiResult.data ?? [];
  const activeTeachers = teachers.filter((teacher) => teacher.is_active);
  const activeStudentIds = new Set(
    (studentsResult.data ?? []).map((student) => student.id),
  );
  const assignedStudentIds = new Set(
    (assignmentsResult.data ?? [])
      .map((assignment) => assignment.student_id)
      .filter((studentId) => activeStudentIds.has(studentId)),
  );
  const unassignedCount = Math.max(
    0,
    activeStudentIds.size - assignedStudentIds.size,
  );
  const weakTeachers = teachers.filter(
    (teacher) => teacher.is_active && teacher.weak_student_count > 0,
  );

  return (
    <>
      <PageHeader
        title="Guru"
        description="Kelola akun guru, murid yang diampu, dan pantau capaian tiap guru."
        actions={<CreateTeacherDialog />}
      />

      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Guru aktif"
            value={activeTeachers.length}
            tone="success"
          />
          <StatCard label="Murid aktif" value={activeStudentIds.size} />
          <StatCard
            label="Murid tanpa guru"
            value={unassignedCount}
            tone={unassignedCount > 0 ? "warning" : "neutral"}
          />
          <StatCard
            label="Guru dengan murid di bawah 60"
            value={weakTeachers.length}
            tone={weakTeachers.length > 0 ? "accent" : "neutral"}
          />
        </div>

        {kpiResult.error ? (
          <Alert tone="error">
            Data kinerja guru belum dapat dimuat. Pastikan migrasi terbaru sudah
            diterapkan ke database.
          </Alert>
        ) : teachers.length === 0 ? (
          <EmptyState
            title="Belum ada guru"
            description="Tambahkan akun guru pertama, lalu tugaskan murid kepadanya."
            action={<CreateTeacherDialog />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">No</TableHead>
                <TableHead className="w-[18%] min-w-[150px] text-left">
                  Guru
                </TableHead>
                <TableHead className="w-[12%] text-left">Username</TableHead>
                <TableHead numeric className="w-[7%]">
                  Murid
                </TableHead>
                <TableHead numeric className="w-[8%]">
                  Selesai
                </TableHead>
                <TableHead numeric className="w-[8%]">
                  Rata-rata
                </TableHead>
                <TableHead numeric className="w-[9%]">
                  Nilai &lt; 60
                </TableHead>
                <TableHead className="w-[15%]">Aktivitas terakhir</TableHead>
                <TableHead className="w-[9%]">Status</TableHead>
                <TableHead className="w-16">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((teacher, index) => (
                <TableRow key={teacher.teacher_id}>
                  <TableCell className="font-mono text-xs tabular">
                    {index + 1}
                  </TableCell>
                  <TableCell className="text-left font-medium">
                    <Link
                      href={`/admin/teachers/${teacher.teacher_id}`}
                      className="hover:text-primary hover:underline"
                    >
                      {teacher.full_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-left font-mono text-xs tabular text-text-muted">
                    {teacher.username}
                  </TableCell>
                  <TableCell numeric>{teacher.student_count}</TableCell>
                  <TableCell numeric>{teacher.completed_count}</TableCell>
                  <TableCell numeric>
                    {teacher.completed_count > 0
                      ? `${Number(teacher.avg_percentage).toFixed(1)}%`
                      : "-"}
                  </TableCell>
                  <TableCell numeric>
                    {teacher.weak_student_count > 0 ? (
                      <span className="font-semibold text-[#A62626]">
                        {teacher.weak_student_count}
                      </span>
                    ) : (
                      "0"
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs tabular text-text-muted">
                    {teacher.last_activity_at
                      ? formatDateTime(teacher.last_activity_at)
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {teacher.is_active ? (
                      <Badge tone="success">Aktif</Badge>
                    ) : (
                      <Badge tone="muted">Nonaktif</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <TeacherRowActions
                      teacher={{
                        id: teacher.teacher_id,
                        fullName: teacher.full_name,
                        username: teacher.username,
                        isActive: teacher.is_active,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
