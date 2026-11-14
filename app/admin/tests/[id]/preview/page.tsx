import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { QuestionView } from "@/components/student/question-view";
import { createClient } from "@/lib/supabase/server";
import { signMedia } from "@/lib/storage";

export const metadata = { title: "Pratinjau tes" };

const SECTION_ORDER = { listening: 0, reading: 1 } as const;

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [test, questions] = await Promise.all([
    supabase.from("tests").select("id, title, description").eq("id", id).maybeSingle(),
    supabase
      .from("questions")
      .select(
        "id, section, position, prompt, image_path, audio_path, question_options(id, label, text)",
      )
      .eq("test_id", id)
      .order("position", { ascending: true }),
  ]);

  if (!test.data) notFound();

  const ordered = [...(questions.data ?? [])].sort((a, b) => {
    if (a.section !== b.section) {
      return SECTION_ORDER[a.section] - SECTION_ORDER[b.section];
    }
    return a.position - b.position;
  });

  const rendered = await Promise.all(
    ordered.map(async (question, index) => {
      const [imageUrl, audioUrl] = await Promise.all([
        signMedia(question.image_path),
        signMedia(question.audio_path),
      ]);
      return {
        id: question.id,
        number: index + 1,
        section: question.section,
        prompt: question.prompt,
        imageUrl,
        audioUrl,
        options: [...(question.question_options ?? [])].sort((a, b) =>
          a.label.localeCompare(b.label),
        ),
      };
    }),
  );

  return (
    <>
      <PageHeader
        title="Pratinjau"
        description={test.data.title}
        actions={
          <LinkButton href={`/admin/tests/${id}`} variant="secondary">
            Kembali
          </LinkButton>
        }
      />

      <div className="flex max-w-[720px] flex-col gap-6">
        <Alert tone="info">
          Ini pratinjau sebagai murid. Tidak ada timer dan tidak ada pengerjaan
          yang dibuat. Kunci jawaban tidak ditampilkan.
        </Alert>

        {test.data.description ? (
          <p className="text-sm text-text-muted">{test.data.description}</p>
        ) : null}

        {rendered.length === 0 ? (
          <EmptyState
            title="Belum ada soal"
            description="Tambahkan soal sebelum melihat pratinjau."
          />
        ) : (
          rendered.map((question) => (
            <QuestionView key={question.id} question={question} />
          ))
        )}
      </div>
    </>
  );
}
