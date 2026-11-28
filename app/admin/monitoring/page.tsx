import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { TeacherStudentMonitor } from "@/components/admin/reports/teacher-student-monitor";

export const metadata = {
  title: "Pantau Nilai Murid · Bright Mandarin",
};

export type StudentAttemptSummary = {
  id: string;
  testTitle: string;
  testLevel: number;
  percentage: number;
  correctCount: number;
  totalCount: number;
  submittedAt: string | null;
  status: "submitted" | "expired";
};

export type StudentMonitorData = {
  id: string;
  fullName: string;
  username: string;
  isActive: boolean;
  assignedAt: string;
  completedAttemptsCount: number;
  averageScore: number | null;
  latestScore: number | null;
  attempts: StudentAttemptSummary[];
};

export type TeacherMonitorData = {
  id: string;
  fullName: string;
  username: string;
  isActive: boolean;
  studentCount: number;
  overallAverage: number | null;
  weakStudentCount: number;
  students: StudentMonitorData[];
};

export default async function OwnerMonitoringPage() {
  await requireOwner();
  const supabase = await createClient();

  // 1. Ambil semua profil guru
  const teachersResult = await supabase
    .from("profiles")
    .select("id, full_name, username, is_active")
    .eq("role", "teacher")
    .order("is_active", { ascending: false })
    .order("full_name", { ascending: true });

  const teachers = teachersResult.data ?? [];

  // 2. Ambil penugasan guru-murid aktif
  const assignmentsResult = await supabase
    .from("teacher_students")
    .select("teacher_id, student_id, assigned_at")
    .is("ended_at", null);

  const assignments = assignmentsResult.data ?? [];
  const studentIds = Array.from(new Set(assignments.map((a) => a.student_id)));

  // 3. Ambil data murid & attempt murid
  const [studentsResult, attemptsResult] = await Promise.all([
    studentIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, username, is_active")
          .in("id", studentIds)
      : Promise.resolve({ data: [] }),
    studentIds.length > 0
      ? supabase
          .from("attempts")
          .select(
            "id, student_id, status, correct_count, total_count, submitted_at, tests(title, level)",
          )
          .in("student_id", studentIds)
          .in("status", ["submitted", "expired"])
          .order("submitted_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const studentProfileMap = new Map(
    (studentsResult.data ?? []).map((s) => [s.id, s]),
  );

  // Group attempts per student
  const studentAttemptsMap = new Map<string, StudentAttemptSummary[]>();
  for (const att of attemptsResult.data ?? []) {
    if (!att.total_count || att.total_count === 0) continue;
    const testData = att.tests as { title: string; level: number } | null;
    const list = studentAttemptsMap.get(att.student_id) ?? [];
    const pct = Math.round(((att.correct_count ?? 0) / att.total_count) * 100);
    list.push({
      id: att.id,
      testTitle: testData?.title ?? "Tes",
      testLevel: testData?.level ?? 1,
      percentage: pct,
      correctCount: att.correct_count ?? 0,
      totalCount: att.total_count,
      submittedAt: att.submitted_at,
      status: att.status as "submitted" | "expired",
    });
    studentAttemptsMap.set(att.student_id, list);
  }

  // 4. Bangun hierarki Guru -> Murid
  const teacherMonitorList: TeacherMonitorData[] = teachers.map((teacher) => {
    const teacherAssignments = assignments.filter(
      (a) => a.teacher_id === teacher.id,
    );

    const students: StudentMonitorData[] = teacherAssignments
      .map((asg) => {
        const profile = studentProfileMap.get(asg.student_id);
        if (!profile) return null;
        const attempts = studentAttemptsMap.get(asg.student_id) ?? [];
        const averageScore =
          attempts.length > 0
            ? Math.round(
                attempts.reduce((sum, a) => sum + a.percentage, 0) /
                  attempts.length,
              )
            : null;
        const latestScore =
          attempts.length > 0 ? attempts[0].percentage : null;

        return {
          id: profile.id,
          fullName: profile.full_name,
          username: profile.username,
          isActive: profile.is_active,
          assignedAt: asg.assigned_at,
          completedAttemptsCount: attempts.length,
          averageScore,
          latestScore,
          attempts,
        };
      })
      .filter((s): s is StudentMonitorData => s !== null)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    const scoredStudents = students.filter((s) => s.averageScore !== null);
    const overallAverage =
      scoredStudents.length > 0
        ? Math.round(
            scoredStudents.reduce(
              (sum, s) => sum + (s.averageScore ?? 0),
              0,
            ) / scoredStudents.length,
          )
        : null;

    const weakStudentCount = students.filter(
      (s) => s.averageScore !== null && s.averageScore < 60,
    ).length;

    return {
      id: teacher.id,
      fullName: teacher.full_name,
      username: teacher.username,
      isActive: teacher.is_active,
      studentCount: students.length,
      overallAverage,
      weakStudentCount,
      students,
    };
  });

  // Statistik agregat untuk Owner
  const totalStudents = studentIds.length;
  const allScored = teacherMonitorList.flatMap((t) =>
    t.students.map((s) => s.averageScore).filter((v): v is number => v !== null),
  );
  const globalAverage =
    allScored.length > 0
      ? Math.round(allScored.reduce((a, b) => a + b, 0) / allScored.length)
      : null;
  const totalWeakStudents = teacherMonitorList.reduce(
    (sum, t) => sum + t.weakStudentCount,
    0,
  );

  return (
    <>
      <PageHeader
        title="Pantau Nilai Murid"
        description="Hierarki laporan performa belajar: Guru → Murid beserta grafik tren nilai terkini."
      />

      <div className="flex flex-col gap-6">
        {/* Ringkasan Eksekutif */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Guru terdaftar"
            value={teachers.length}
            tone="primary"
          />
          <StatCard
            label="Murid terpantau"
            value={totalStudents}
            tone="success"
          />
          <StatCard
            label="Rata-rata keseluruhan"
            value={globalAverage !== null ? `${globalAverage}%` : "-"}
            tone="neutral"
          />
          <StatCard
            label="Murid perlu bantuan (<60)"
            value={totalWeakStudents}
            tone={totalWeakStudents > 0 ? "accent" : "neutral"}
          />
        </div>

        {teacherMonitorList.length === 0 ? (
          <EmptyState
            title="Belum ada data guru"
            description="Tambahkan guru dan tugaskan murid untuk mulai memantau laporan nilai."
          />
        ) : (
          <TeacherStudentMonitor data={teacherMonitorList} />
        )}
      </div>
    </>
  );
}
