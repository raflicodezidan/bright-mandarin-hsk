import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStudent } from "@/lib/auth";
import { TakeClient } from "./take-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mengerjakan tes" };

const SECTION_ORDER = { listening: 0, reading: 1 } as const;

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
    supabase.from("tests").select("title").eq("id", id).maybeSingle(),
    supabase
      .from("questions")
      .select(
        "id, section, position, prompt, image_path, audio_path, question_type, pdf_path, question_options(id, label, text)",
      )
      .eq("test_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("attempt_answers")
      .select("question_id, selected_option_id, answer_payload")
      .eq("attempt_id", attempt.data.id),
  ]);

  if (!testResult.data) notFound();

  const ordered = [...(questionsResult.data ?? [])].sort((a, b) => {
    if (a.section !== b.section) {
      return SECTION_ORDER[a.section] - SECTION_ORDER[b.section];
    }
    return a.position - b.position;
  });

  const questions = await Promise.all(ordered.map(async (question, index) => {
    const interaction = question.question_type === "multiple_choice"
      ? null
      : await supabase.rpc("interactive_question_payload", { p_question_id: question.id });
    const payload = interaction?.data as { interaction_config?: import("@/lib/supabase/database.types").Json } | null;
    return {
      id: question.id,
      number: index + 1,
      section: question.section,
      prompt: question.prompt,
      imagePath: question.image_path,
      audioPath: question.audio_path,
      pdfPath: question.pdf_path,
      pdfOverlays: question.pdf_path
        ? ((await supabase.from("pdf_choice_overlays").select("page_number, label, x, y, width, height, option_id").eq("question_id", question.id)).data ?? []).map((overlay) => ({
            pageNumber: overlay.page_number,
            label: overlay.label,
            x: Number(overlay.x),
            y: Number(overlay.y),
            width: Number(overlay.width),
            height: Number(overlay.height),
            optionId: overlay.option_id,
          }))
        : [],
      questionType: question.question_type,
      interactionConfig: payload?.interaction_config ?? {},
      options: [...(question.question_options ?? [])]
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((option) => ({ id: option.id, label: option.label, text: option.text })),
    };
  }));

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
      testTitle={testResult.data.title}
      expiresAt={attempt.data.expires_at}
      serverNow={serverNow.toISOString()}
      questions={questions}
      initialAnswers={initialAnswers}
      initialInteractiveAnswers={initialInteractiveAnswers}
      studentName={profile.full_name}
    />
  );
}
