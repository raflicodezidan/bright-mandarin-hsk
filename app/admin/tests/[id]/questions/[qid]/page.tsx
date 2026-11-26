import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/link-button";
import {
  QuestionForm,
  type QuestionFormInitial,
} from "@/components/admin/tests/question-form";
import { createClient } from "@/lib/supabase/server";
import { isOwnerRole, requireStaff } from "@/lib/auth";
import { signMedia } from "@/lib/storage";
import type { Tables } from "@/lib/supabase/database.types";

export const metadata = { title: "Soal" };

export default async function QuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; qid: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { id, qid } = await params;
  const query = await searchParams;
  const profile = await requireStaff();
  const isOwner = isOwnerRole(profile.role);
  const supabase = await createClient();

  const test = await supabase
    .from("tests")
    .select("id, title, created_by, listening_audio_path")
    .eq("id", id)
    .maybeSingle();

  if (!test.data) notFound();

  if (!isOwner && test.data.created_by !== profile.id) {
    redirect(`/admin/tests/${id}`);
  }

  const attempts = await supabase
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("test_id", id);

  const hasAttempts = (attempts.count ?? 0) > 0;
  const locked = hasAttempts && qid === "new";

  let initial: QuestionFormInitial | undefined;
  let existingImage: string | null = null;
  let existingAudio: string | null = null;
  let questionId = "new";

  if (qid !== "new") {
    const question = await supabase
      .from("questions")
      .select(
        "id, test_id, section, prompt, image_path, audio_path, question_type, interaction_config, question_options(id, label, text, image_path), answer_keys(correct_option_id), interactive_answer_keys(answer)",
      )
      .eq("id", qid)
      .maybeSingle();

    if (!question.data || question.data.test_id !== id) notFound();

    questionId = question.data.id;
    existingImage = question.data.image_path;
    existingAudio = question.data.audio_path;

    const options = [...(question.data.question_options ?? [])].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
    const correctOptionId = question.data.answer_keys?.correct_option_id;
    const correct = options.find((option) => option.id === correctOptionId);

    initial = {
      section: question.data.section,
      prompt: question.data.prompt,
        options: options.map((option) => ({
          label: option.label,
          text: option.text ?? "",
          imagePath: option.image_path,
          imageUrl: option.image_path ? `/api/media?path=${encodeURIComponent(option.image_path)}` : null,
        })),
      correctLabel: correct?.label ?? "",
      questionType: question.data.question_type,
      interactionConfig: question.data.interaction_config,
      interactionAnswer: question.data.interactive_answer_keys?.answer,
    };
  } else {
    const section =
      query.section === "reading" ? "reading" : ("listening" as const);
    initial = {
      section,
      prompt: "",
      options: [],
      correctLabel: "A",
    };
  }

  const [imageUrl, audioUrl, sharedListeningAudioUrl] = await Promise.all([
    signMedia(existingImage),
    signMedia(existingAudio),
    signMedia(test.data.listening_audio_path),
  ]);

  return (
    <>
      <PageHeader
        title={qid === "new" ? "Tambah soal" : "Edit soal"}
        description={test.data.title}
        actions={
          <LinkButton href={`/admin/tests/${id}`} variant="secondary">
            <ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" />
            Kembali
          </LinkButton>
        }
      />
      <QuestionForm
        testId={id}
        questionId={questionId}
        initial={initial}
        existingImage={existingImage}
        existingAudio={existingAudio}
        imageUrl={imageUrl}
        audioUrl={audioUrl}
        sharedListeningAudioUrl={sharedListeningAudioUrl}
        locked={locked}
        textOnly={hasAttempts && qid !== "new"}
      />
    </>
  );
}

export type QuestionRow = Tables<"questions">;
