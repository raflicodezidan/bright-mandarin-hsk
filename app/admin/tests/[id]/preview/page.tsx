import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { QuestionView } from "@/components/student/question-view";
import { PdfQuestionView } from "@/components/student/pdf-question-view";
import { createClient } from "@/lib/supabase/server";
import { signMedia } from "@/lib/storage";

export const metadata = { title: "Pratinjau tes" };

const SECTION_ORDER = { listening: 0, reading: 1 } as const;
const OVERLAY_KINDS = ["choice", "blank", "match", "drop"] as const;
type OverlayKind = (typeof OVERLAY_KINDS)[number];

function isOverlayKind(value: string | undefined): value is OverlayKind {
  return value !== undefined && (OVERLAY_KINDS as readonly string[]).includes(value);
}

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [test, questions] = await Promise.all([
    supabase
      .from("tests")
      .select("id, title, description, pdf_path, student_pdf_path")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("questions")
      .select(
        "id, section, position, prompt, image_path, audio_path, question_type, interaction_config, question_options(id, label, text, image_path)",
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

  // Pratinjau staf memakai PDF murid bila ada. Jika belum diunggah, pakai PDF
  // guru agar admin dapat memeriksa posisi lingkaran/titik yang sudah dibuat.
  // Halaman ujian murid tetap hanya memakai PDF murid yang bersih.
  const studentPdfPath = test.data.student_pdf_path;
  const previewPdfPath = studentPdfPath ?? test.data.pdf_path;
  const usingTeacherPdf = !studentPdfPath && Boolean(test.data.pdf_path);

  const rendered = await Promise.all(
    ordered.map(async (question, index) => {
      const [imageUrl, audioUrl] = await Promise.all([
        signMedia(question.image_path),
        signMedia(question.audio_path),
      ]);

      const config = (question.interaction_config ?? {}) as {
        overlays?: {
          id?: string;
          kind?: string;
          pageNumber?: number;
          label?: string;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
        }[];
      };
      const defaultKind =
        question.question_type === "multiple_choice"
          ? "choice"
          : question.question_type === "matching"
            ? "match"
            : question.question_type === "rearrange_sentence"
              ? "drop"
              : "blank";
      const overlays = (config.overlays ?? [])
        .filter(
          (overlay) =>
            typeof overlay.pageNumber === "number" &&
            typeof overlay.x === "number" &&
            typeof overlay.y === "number",
        )
        .map((overlay, overlayIndex) => ({
          id: overlay.id ?? overlay.label ?? `overlay-${overlayIndex}`,
          kind: isOverlayKind(overlay.kind) ? overlay.kind : defaultKind,
          pageNumber: Number(overlay.pageNumber),
          label: overlay.label,
          x: Number(overlay.x),
          y: Number(overlay.y),
          width: Number(overlay.width ?? 0.045),
          height: Number(overlay.height ?? 0.065),
        }));

      const audioPath = question.audio_path ?? null;
      return {
        id: question.id,
        number: index + 1,
        section: question.section,
        prompt: question.prompt,
        imagePath: question.image_path,
        audioPath,
        imageUrl,
        audioUrl,
        pdfPath: overlays.length > 0 ? previewPdfPath : null,
        pdfOverlays: overlays,
        questionType: question.question_type,
        interactionConfig: question.interaction_config ?? {},
        options: [...(question.question_options ?? [])]
          .sort((a, b) => a.label.localeCompare(b.label))
          .map((option) => ({ id: option.id, label: option.label, text: option.text ?? "", imagePath: option.image_path, imageUrl: option.image_path ? `/api/media?path=${encodeURIComponent(option.image_path)}` : null })),
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
            <ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" />
            Kembali
          </LinkButton>
        }
      />

      <div className="flex max-w-[720px] flex-col gap-6">
        <Alert tone="info">
          Ini pratinjau sebagai murid. Tidak ada timer dan tidak ada pengerjaan
          yang dibuat. Kunci jawaban tidak ditampilkan.
        </Alert>

        {usingTeacherPdf ? (
          <Alert tone="warning" title="PDF murid belum diunggah">
            Pratinjau memakai PDF guru agar posisi soal dapat diperiksa. PDF guru
            bisa memuat kunci jawaban; jangan tampilkan pratinjau ini kepada murid.
            Unggah PDF murid yang bersih agar halaman ujian murid menampilkan
            dokumen.
          </Alert>
        ) : null}

        {test.data.description ? (
          <p className="text-sm text-text-muted">{test.data.description}</p>
        ) : null}

        {rendered.length === 0 ? (
          <EmptyState
            title="Belum ada soal"
            description="Tambahkan soal sebelum melihat pratinjau."
          />
        ) : (
          rendered.map((question) =>
            question.pdfPath ? (
              <PdfQuestionView
                key={question.id}
                question={question}
                disabled
              />
            ) : (
              <QuestionView
                key={question.id}
                question={{
                  number: question.number,
                  section: question.section,
                  prompt: question.prompt,
                  imageUrl: question.imageUrl,
                  audioUrl: question.audioUrl,
                  options: question.options,
                }}
                disabled
              />
            ),
          )
        )}
      </div>
    </>
  );
}
