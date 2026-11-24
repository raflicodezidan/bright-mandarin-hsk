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
    .select("id, title, created_by")
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
        "id, test_id, section, prompt, image_path, audio_path, question_options(id, label, text), answer_keys(correct_option_id)",
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
        text: option.text,
      })),
      correctLabel: correct?.label ?? "A",
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

  const [imageUrl, audioUrl] = await Promise.all([
    signMedia(existingImage),
    signMedia(existingAudio),
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
        locked={locked}
        textOnly={hasAttempts && qid !== "new"}
      />
    </>
  );
}

export type QuestionRow = Tables<"questions">;
