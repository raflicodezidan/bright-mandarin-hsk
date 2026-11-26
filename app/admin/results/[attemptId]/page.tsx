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
        "id, section, position, prompt, question_type, interaction_config, question_options(id, label, text, image_path), answer_keys(correct_option_id), interactive_answer_keys(answer)",
      )
      .eq("test_id", attempt.data.test_id)
      .order("position", { ascending: true }),
    supabase
      .from("attempt_answers")
      .select("question_id, selected_option_id, answer_payload")
      .eq("attempt_id", attemptId),
  ]);

  const answers = new Map(
    (answersResult.data ?? []).map((answer) => [
      answer.question_id,
      { selectedOptionId: answer.selected_option_id, payload: answer.answer_payload as Record<string, unknown> },
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
                const answer = answers.get(question.id);
                const selectedId = answer?.selectedOptionId ?? null;
                const options = question.question_options ?? [];
                const selected = options.find(
                  (option) => option.id === selectedId,
                );
                const correctId = question.answer_keys?.correct_option_id;
                const correct = options.find(
                  (option) => option.id === correctId,
                );
                const isInteractive = question.question_type !== "multiple_choice";
                const config = (question.interaction_config ?? {}) as {
                  choices?: { label: string; text: string }[];
                  leftItems?: { id: string; text: string }[];
                  rightItems?: { id: string; text: string }[];
                };
                const key = question.interactive_answer_keys?.answer as Record<string, unknown> | undefined;
                const choiceText = (label: unknown) =>
                  config.choices?.find((choice) => choice.label === label)?.text ?? "";
                const leftText = (id: unknown) =>
                  config.leftItems?.find((item) => item.id === id)?.text ?? String(id ?? "");
                const rightText = (id: unknown) =>
                  config.rightItems?.find((item) => item.id === id)?.text ?? String(id ?? "");
                const matchesPayload = (left: unknown, right: unknown) => {
                  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) return false;
                  const a = left as Record<string, unknown>;
                  const b = right as Record<string, unknown>;
                  const keys = Object.keys(b);
                  return keys.length > 0 && keys.length === Object.keys(a).length && keys.every((item) => a[item] === b[item]);
                };
                const isCorrect = question.question_type === "matching"
                  ? matchesPayload(answer?.payload?.matches, key?.matches)
                  : question.question_type === "hanzi_blank"
                    ? answer?.payload?.selectedLabel === key?.correctLabel
                    : question.question_type === "rearrange_sentence"
                      ? JSON.stringify(answer?.payload?.order ?? []) === JSON.stringify(key?.order ?? [])
                      : Boolean(selectedId && correctId && selectedId === correctId);

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
                      {isInteractive ? (
                        question.question_type === "hanzi_blank" ? (
                          answer?.payload?.selectedLabel ? (
                            <span className="text-sm">
                              <span className="font-mono">
                                {String(answer.payload.selectedLabel).toUpperCase()}.
                              </span>{" "}
                              <span className="font-cjk" lang="zh-Hans">
                                {choiceText(answer.payload.selectedLabel)}
                              </span>
                            </span>
                          ) : (
                            <Badge tone="muted">Tidak dijawab</Badge>
                          )
                        ) : question.question_type === "matching" ? (
                          answer?.payload?.matches &&
                          Object.keys(answer.payload.matches as Record<string, string>).length > 0 ? (
                            <div className="flex flex-col gap-1 text-sm">
                              {Object.entries(answer.payload.matches as Record<string, string>).map(
                                ([leftId, rightId]) => (
                                  <span key={leftId} className="font-cjk" lang="zh-Hans">
                                    {leftText(leftId)} → {rightText(rightId)}
                                  </span>
                                ),
                              )}
                            </div>
                          ) : (
                            <Badge tone="muted">Tidak dijawab</Badge>
                          )
                        ) : question.question_type === "rearrange_sentence" ? (
                          <span className="font-cjk text-sm" lang="zh-Hans">
                            {(answer?.payload?.order as string[] | undefined)?.join(" ") ?? "-"}
                          </span>
                        ) : (
                          <span className="max-w-md whitespace-pre-wrap break-all font-cjk text-sm" lang="zh-Hans">
                            {JSON.stringify(answer?.payload ?? {})}
                          </span>
                        )
                      ) : selected ? (
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
                      {isInteractive ? (
                        question.question_type === "hanzi_blank" ? (
                          key?.correctLabel ? (
                            <span className="text-sm">
                              <span className="font-mono">
                                {String(key.correctLabel).toUpperCase()}.
                              </span>{" "}
                              <span className="font-cjk" lang="zh-Hans">
                                {choiceText(key.correctLabel)}
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted">-</span>
                          )
                        ) : question.question_type === "matching" ? (
                          key?.matches &&
                          Object.keys(key.matches as Record<string, string>).length > 0 ? (
                            <div className="flex flex-col gap-1 text-sm">
                              {Object.entries(key.matches as Record<string, string>).map(
                                ([leftId, rightId]) => (
                                  <span key={leftId} className="font-cjk" lang="zh-Hans">
                                    {leftText(leftId)} → {rightText(rightId)}
                                  </span>
                                ),
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-text-muted">-</span>
                          )
                        ) : question.question_type === "rearrange_sentence" ? (
                          <span className="font-cjk text-sm" lang="zh-Hans">
                            {(key?.order as string[] | undefined)?.join(" ") ?? "-"}
                          </span>
                        ) : (
                          <span className="max-w-md whitespace-pre-wrap break-all font-cjk text-sm" lang="zh-Hans">
                            {JSON.stringify(key ?? {})}
                          </span>
                        )
                      ) : correct ? (
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
                      {!selected && !answer?.payload ? (
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
