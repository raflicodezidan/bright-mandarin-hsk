import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { ArrowLeft, Link2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TestForm } from "@/components/admin/tests/test-form";
import { TestStatusActions } from "@/components/admin/tests/test-status-actions";
import {
  QuestionList,
  type QuestionListItem,
} from "@/components/admin/tests/question-list";
import { createClient } from "@/lib/supabase/server";
import { TestStatusBadge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/format";

export const metadata = { title: "Kelola tes" };

export default async function TestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [testResult, questionsResult, attemptsResult] = await Promise.all([
    supabase.from("tests").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("questions")
      .select(
        "id, section, position, prompt, image_path, audio_path, question_options(label), answer_keys(correct_option_id)",
      )
      .eq("test_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("test_id", id),
  ]);

  const test = testResult.data;
  if (!test) notFound();

  const questions = questionsResult.data ?? [];
  const attemptCount = attemptsResult.count ?? 0;
  const hasAttempts = attemptCount > 0;

  function toItems(section: "listening" | "reading"): QuestionListItem[] {
    return questions
      .filter((question) => question.section === section)
      .map((question, index) => ({
        id: question.id,
        number: index + 1,
        prompt: question.prompt,
        hasAudio: Boolean(question.audio_path),
        hasImage: Boolean(question.image_path),
        hasKey: Boolean(question.answer_keys),
      }));
  }

  const listening = toItems("listening");
  const reading = toItems("reading");
  const missingKey = questions.filter((question) => !question.answer_keys).length;

  return (
    <>
      <PageHeader
        title={test.title}
        description={`HSK ${test.level} · ${formatDuration(test.duration_minutes)}`}
        actions={
          <>
            <LinkButton href="/admin/tests" variant="secondary">
              <ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" />
              Kembali
            </LinkButton>
            <LinkButton
              href={`/admin/tests/${test.id}/preview`}
              variant="secondary"
            >
              Pratinjau
            </LinkButton>
          </>
        }
      />

      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center gap-3">
          <TestStatusBadge status={test.status} />
          <span className="text-xs text-text-muted">
            {questions.length} soal · {attemptCount} pengerjaan
          </span>
        </div>

        {hasAttempts ? (
          <Alert tone="warning" title="Pengeditan setelah pengerjaan">
            Teks soal, teks opsi, dan kunci jawaban dapat diubah. Nilai pengerjaan
            yang sudah selesai dihitung ulang dengan kunci terbaru. Untuk tes
            yang sedang berlangsung, teks opsi yang sudah dipilih murid tidak
            bisa diubah. Bagian, urutan, jumlah opsi, media, dan durasi terkunci.
          </Alert>
        ) : missingKey > 0 ? (
          <Alert tone="warning" title="Lengkapi kunci jawaban">
            Ada {missingKey} soal tanpa kunci. Tes tidak dapat dibuka sebelum
            semua soal memiliki kunci.
          </Alert>
        ) : null}

        <TestForm
          mode="edit"
          testId={test.id}
          initial={{
            title: test.title,
            level: test.level,
            description: test.description,
            durationMinutes: test.duration_minutes,
          }}
          lockedDuration={hasAttempts}
        />

        <Card title="Status tes">
          <TestStatusActions
            testId={test.id}
            status={test.status}
            hasAttempts={hasAttempts}
          />
        </Card>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-text">Listening</h2>
              <Badge tone="neutral">{listening.length} soal</Badge>
            </div>
            <LinkButton
              href={`/admin/tests/${test.id}/questions/new?section=listening`}
              size="sm"
              variant="secondary"
              aria-disabled={hasAttempts}
              className={hasAttempts ? "pointer-events-none opacity-60" : undefined}
            >
              Tambah soal
            </LinkButton>
          </div>
          <QuestionList
            testId={test.id}
            items={listening}
            locked={false}
            textOnly={hasAttempts}
          />
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-text">Reading</h2>
              <Badge tone="neutral">{reading.length} soal</Badge>
            </div>
            <LinkButton
              href={`/admin/tests/${test.id}/questions/new?section=reading`}
              size="sm"
              variant="secondary"
              aria-disabled={hasAttempts}
              className={hasAttempts ? "pointer-events-none opacity-60" : undefined}
            >
              Tambah soal
            </LinkButton>
          </div>
          <QuestionList testId={test.id} items={reading} locked={false} textOnly={hasAttempts} />
        </section>

        <p className="flex items-center gap-2 text-xs text-text-muted">
          <Link2 size={14} strokeWidth={1.5} aria-hidden="true" />
          Pratinjau menampilkan tes seperti yang dilihat murid, tanpa timer dan
          tanpa membuat pengerjaan.
        </p>
      </div>
    </>
  );
}
