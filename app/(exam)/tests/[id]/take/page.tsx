import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudent } from "@/lib/auth";
import { TakeClient } from "./take-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mengerjakan tes" };

const SECTION_ORDER = { listening: 0, reading: 1 } as const;

const OVERLAY_KINDS = ["choice", "blank", "match", "drop"] as const;
type OverlayKind = (typeof OVERLAY_KINDS)[number];

function isOverlayKind(value: string | undefined): value is OverlayKind {
  return value !== undefined && (OVERLAY_KINDS as readonly string[]).includes(value);
}

export default async function TakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireStudent();
  const { id } = await params;
  const supabase = await createClient();

  const attempt = await supabase
    .from("student_attempt_status")
    .select("*")
    .eq("test_id", id)
    .maybeSingle();

  if (!attempt.data || attempt.data.status !== "in_progress") {
    redirect(`/tests/${id}/done`);
  }

  const serverNow = new Date();

  if (new Date(attempt.data.expires_at).getTime() <= serverNow.getTime()) {
    await supabase.rpc("submit_attempt", { p_attempt_id: attempt.data.id });
    redirect(`/tests/${id}/done`);
  }

  const [testResult, questionsResult, answersResult] = await Promise.all([
    supabase.from("tests").select("title, student_pdf_path").eq("id", id).maybeSingle(),
    supabase
      .from("questions")
      .select(
        "id, section, position, prompt, image_path, audio_path, question_type, interaction_config, question_options(id, label, text)",
      )
      .eq("test_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("attempt_answers")
      .select("question_id, selected_option_id, answer_payload")
      .eq("attempt_id", attempt.data.id),
  ]);

  if (!testResult.data) notFound();
  const studentPdfPath = testResult.data.student_pdf_path;
  const testTitle = testResult.data.title;

  const ordered = [...(questionsResult.data ?? [])].sort((a, b) => {
    if (a.section !== b.section) {
      return SECTION_ORDER[a.section] - SECTION_ORDER[b.section];
    }
    return a.position - b.position;
  });

  const questions = ordered.map((question, index) => {
    const config = (question.interaction_config ?? {}) as {
      overlays?: { id?: string; kind?: string; pageNumber?: number; label?: string; x?: number; y?: number; width?: number; height?: number }[];
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
      .filter((overlay) => typeof overlay.pageNumber === "number" && typeof overlay.x === "number" && typeof overlay.y === "number")
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
    return {
      id: question.id,
      number: index + 1,
      section: question.section,
      prompt: question.prompt,
      imagePath: question.image_path,
      audioPath: question.audio_path,
      pdfPath: overlays.length > 0 ? studentPdfPath : null,
      pdfOverlays: overlays,
      questionType: question.question_type,
      interactionConfig: question.interaction_config ?? {},
      options: [...(question.question_options ?? [])]
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((option) => ({ id: option.id, label: option.label, text: option.text })),
    };
  });

  const initialAnswers: Record<string, string> = {};
  const initialInteractiveAnswers: Record<string, Record<string, unknown>> = {};
  for (const answer of answersResult.data ?? []) {
    if (answer.selected_option_id) initialAnswers[answer.question_id] = answer.selected_option_id;
    if (answer.answer_payload && Object.keys(answer.answer_payload).length > 0) {
      initialInteractiveAnswers[answer.question_id] = answer.answer_payload as Record<string, unknown>;
    }
  }

  return (
    <TakeClient
      attemptId={attempt.data.id}
      testId={id}
      testTitle={testTitle}
      expiresAt={attempt.data.expires_at}
      serverNow={serverNow.toISOString()}
      questions={questions}
      initialAnswers={initialAnswers}
      initialInteractiveAnswers={initialInteractiveAnswers}
      studentName={profile.full_name}
    />
  );
}
