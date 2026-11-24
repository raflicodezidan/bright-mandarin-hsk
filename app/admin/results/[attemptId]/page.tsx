import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Badge, AttemptStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
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
import { requireStaff } from "@/lib/auth";
import { formatDateTime, formatDuration } from "@/lib/format";
import {
  attemptDurationMinutes,
  percentage,
} from "@/lib/attempts";

export const metadata = { title: "Detail hasil" };

const SECTION_ORDER = { listening: 0, reading: 1 } as const;

export default async function ResultDetailPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  await requireStaff();
  const { attemptId } = await params;
  const supabase = await createClient();

  const attempt = await supabase
    .from("attempts")
    .select(
      "*, profiles(full_name, username), tests(id, title, level, duration_minutes)",
    )
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt.data) notFound();

  const assignment = await supabase
    .from("teacher_students")
    .select("teacher_id")
    .eq("student_id", attempt.data.student_id)
    .is("ended_at", null)
    .maybeSingle();

  let teacherName: string | null = null;
  if (assignment.data?.teacher_id) {
    const teacher = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", assignment.data.teacher_id)
      .maybeSingle();
    teacherName = teacher.data?.full_name ?? null;
  }

  const [questionsResult, answersResult] = await Promise.all([
    supabase
      .from("questions")
      .select(
        "id, section, position, prompt, question_options(id, label, text), answer_keys(correct_option_id)",
      )
      .eq("test_id", attempt.data.test_id)
      .order("position", { ascending: true }),
    supabase
      .from("attempt_answers")
      .select("question_id, selected_option_id")
      .eq("attempt_id", attemptId),
  ]);

  const answers = new Map(
    (answersResult.data ?? []).map((answer) => [
      answer.question_id,
      answer.selected_option_id,
    ]),
  );

  const questions = [...(questionsResult.data ?? [])].sort((a, b) => {
    if (a.section !== b.section) {
      return SECTION_ORDER[a.section] - SECTION_ORDER[b.section];
    }
    return a.position - b.position;
  });

  const percent = percentage(
    attempt.data.correct_count,
    attempt.data.total_count,
  );
  const duration = attemptDurationMinutes(
    attempt.data.started_at,
    attempt.data.submitted_at,
  );
  const studentName = attempt.data.profiles?.full_name ?? "Murid";
  const testTitle = attempt.data.tests?.title ?? "Tes";

  return (
    <>
      <PageHeader
        title="Detail pengerjaan"
        description={`${studentName} · ${testTitle}`}
        actions={
          <>
            <ResetAttemptButton
              attemptId={attempt.data.id}
              studentName={studentName}
              testTitle={testTitle}
            />
            <LinkButton href="/admin/results" variant="secondary">
              <ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" />
              Kembali
            </LinkButton>
          </>
        }
      />

      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center gap-2">
          <AttemptStatusBadge status={attempt.data.status} />
          <Badge tone="primary">HSK {attempt.data.tests?.level ?? "-"}</Badge>
          <span className="text-xs text-text-muted">
            {formatDuration(attempt.data.tests?.duration_minutes ?? 0)} · durasi
            terpakai {duration === null ? "-" : `${duration} menit`}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Benar"
            value={`${attempt.data.correct_count ?? 0} / ${attempt.data.total_count ?? 0}`}
          />
          <StatCard label="Persentase" value={percent === null ? "-" : `${percent}%`} />
          <StatCard
            label="Listening"
            value={`${attempt.data.listening_correct ?? 0} / ${attempt.data.listening_total ?? 0}`}
          />
          <StatCard
            label="Reading"
            value={`${attempt.data.reading_correct ?? 0} / ${attempt.data.reading_total ?? 0}`}
          />
        </div>

        <Card>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-text-muted">Murid</dt>
              <dd className="text-sm text-text">
                {studentName}{" "}
                <span className="font-mono text-xs text-text-muted">
                  {attempt.data.profiles?.username}
                </span>
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-text-muted">Guru</dt>
              <dd className="text-sm text-text">
                {teacherName ?? "Belum ditugaskan"}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-text-muted">Tes</dt>
              <dd className="text-sm text-text">
                <Link
                  href={`/admin/tests/${attempt.data.test_id}`}
                  className="hover:text-primary hover:underline"
                >
                  {testTitle}
                </Link>
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-text-muted">Mulai</dt>
              <dd className="text-sm text-text">
                {formatDateTime(attempt.data.started_at)}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-text-muted">Selesai</dt>
              <dd className="text-sm text-text">
                {attempt.data.submitted_at
                  ? formatDateTime(attempt.data.submitted_at)
                  : "-"}
              </dd>
            </div>
          </dl>
        </Card>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-text">Rincian jawaban</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead numeric className="w-12">
                  No
                </TableHead>
                <TableHead>Bagian</TableHead>
                <TableHead>Soal</TableHead>
                <TableHead>Jawaban murid</TableHead>
                <TableHead>Kunci</TableHead>
                <TableHead>Hasil</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((question, index) => {
                const selectedId = answers.get(question.id);
                const options = question.question_options ?? [];
                const selected = options.find(
                  (option) => option.id === selectedId,
                );
                const correctId = question.answer_keys?.correct_option_id;
                const correct = options.find(
                  (option) => option.id === correctId,
                );
                const isCorrect = Boolean(
                  selectedId && correctId && selectedId === correctId,
                );

                return (
                  <TableRow key={question.id}>
                    <TableCell numeric>{index + 1}</TableCell>
                    <TableCell className="whitespace-nowrap text-text-muted">
                      {question.section === "listening" ? "Listening" : "Reading"}
                    </TableCell>
                    <TableCell>
                      <p className="line-clamp-2 max-w-md font-cjk text-sm" lang="zh-Hans">
                        {question.prompt}
                      </p>
                    </TableCell>
                    <TableCell>
                      {selected ? (
                        <span className="text-sm">
                          <span className="font-mono">{selected.label}.</span>{" "}
                          <span className="font-cjk" lang="zh-Hans">
                            {selected.text}
                          </span>
                        </span>
                      ) : (
                        <Badge tone="muted">Tidak dijawab</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {correct ? (
                        <span className="text-sm">
                          <span className="font-mono">{correct.label}.</span>{" "}
                          <span className="font-cjk" lang="zh-Hans">
                            {correct.text}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {!selected ? (
                        <Badge tone="muted">Tidak dijawab</Badge>
                      ) : isCorrect ? (
                        <Badge tone="success">Benar</Badge>
                      ) : (
                        <Badge tone="accent">Salah</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      </div>
    </>
  );
}
