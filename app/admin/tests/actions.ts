"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { getSessionProfile, isOwnerRole, isStaffRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  copyMedia,
  removeMedia,
  signMedia,
  uploadMedia,
  uploadQuestionPdf,
  STORAGE_FILES_TAG,
} from "@/lib/storage";
import {
  interactiveQuestionSchema,
  pdfBlankQuestionSchema,
  pdfChoiceQuestionSchema,
  pdfMatchingQuestionSchema,
  pdfRearrangeQuestionSchema,
  questionInteractionUpdateSchema,
  questionSchema,
  questionTextUpdateSchema,
  testSchema,
  testStatusSchema,
} from "@/lib/validation/tests";
import { setTestAssignmentsSchema } from "@/lib/validation/teachers";
import type { Json, Tables } from "@/lib/supabase/database.types";

export type TestActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function guardStaff(): Promise<{ ok: false; error: string } | null> {
  const session = await getSessionProfile();
  if (!session || !isStaffRole(session.profile.role) || !session.profile.is_active) {
    return { ok: false, error: "Akses ditolak." };
  }
  return null;
}

async function guardOwner(): Promise<{ ok: false; error: string } | null> {
  const session = await getSessionProfile();
  if (!session || !isOwnerRole(session.profile.role) || !session.profile.is_active) {
    return { ok: false, error: "Akses ditolak." };
  }
  return null;
}

function errorMessage(error: { message: string } | null, fallback: string): string {
  if (!error) return fallback;
  const message = error.message.replace(/^P0001:\s*/, "").trim();
  return message.length > 0 ? message : fallback;
}

export async function createTestAction(
  input: unknown,
): Promise<TestActionResult<{ id: string }>> {
  const denied = await guardStaff();
  if (denied) return denied;

  const parsed = testSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Data tes tidak valid.",
    };
  }

  const supabase = await createClient();
  const session = await getSessionProfile();
  const { data, error } = await supabase
    .from("tests")
    .insert({
      title: parsed.data.title,
      level: parsed.data.level,
      description: parsed.data.description,
      duration_minutes: parsed.data.durationMinutes,
      status: "draft",
      created_by: session?.profile.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "Gagal membuat tes. Coba lagi." };
  }

  revalidatePath("/admin/tests");
  return { ok: true, data: { id: data.id } };
}

export async function updateTestAction(input: {
  testId: string;
  title: string;
  level: number;
  description: string;
  durationMinutes: number;
}): Promise<TestActionResult> {
  const denied = await guardStaff();
  if (denied) return denied;

  if (typeof input.testId !== "string") {
    return { ok: false, error: "Data tes tidak valid." };
  }

  const parsed = testSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Data tes tidak valid.",
    };
  }

  const session = await getSessionProfile();
  const supabase = await createClient();
  const { data: test } = await supabase
    .from("tests")
    .select("created_by")
    .eq("id", input.testId)
    .maybeSingle();

  if (!test) return { ok: false, error: "Tes tidak ditemukan." };
  if (
    !session ||
    (!isOwnerRole(session.profile.role) && test.created_by !== session.profile.id)
  ) {
    return { ok: false, error: "Hanya pemilik tes yang dapat mengubah tes ini." };
  }

  const { error } = await supabase
    .from("tests")
    .update({
      title: parsed.data.title,
      level: parsed.data.level,
      description: parsed.data.description,
      duration_minutes: parsed.data.durationMinutes,
    })
    .eq("id", input.testId);

  if (error) {
    return { ok: false, error: errorMessage(error, "Gagal menyimpan tes.") };
  }

  revalidatePath("/admin/tests");
  revalidatePath(`/admin/tests/${input.testId}`);
  return { ok: true, data: undefined };
}

export async function setTestStatusAction(
  input: unknown,
): Promise<TestActionResult> {
  const denied = await guardStaff();
  if (denied) return denied;

  const parsed = testStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const session = await getSessionProfile();
  const supabase = await createClient();
  const { data: test } = await supabase
    .from("tests")
    .select("created_by")
    .eq("id", parsed.data.testId)
    .maybeSingle();

  if (!test) return { ok: false, error: "Tes tidak ditemukan." };
  if (
    !session ||
    (!isOwnerRole(session.profile.role) && test.created_by !== session.profile.id)
  ) {
    return { ok: false, error: "Hanya pemilik tes yang dapat mengubah status." };
  }

  const { error } = await supabase
    .from("tests")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.testId);

  if (error) {
    return { ok: false, error: errorMessage(error, "Gagal mengubah status tes.") };
  }

  revalidatePath("/admin/tests");
  revalidatePath(`/admin/tests/${parsed.data.testId}`);
  return { ok: true, data: undefined };
}

export async function saveQuestionAction(
  formData: FormData,
): Promise<TestActionResult<{ questionId: string }>> {
  const denied = await guardStaff();
  if (denied) return denied;

  const testId = String(formData.get("testId") ?? "");
  const rawQuestionId = String(formData.get("questionId") ?? "new");
  const questionId = rawQuestionId === "new" ? null : rawQuestionId;
  const section = String(formData.get("section") ?? "");
  const prompt = String(formData.get("prompt") ?? "");
  const correctLabel = String(formData.get("correctLabel") ?? "");
  const optionsRaw = String(formData.get("options") ?? "[]");
  const existingImage = String(formData.get("existingImage") ?? "");
  const existingAudio = String(formData.get("existingAudio") ?? "");
  const removeImage = formData.get("removeImage") === "on";
  const removeAudio = formData.get("removeAudio") === "on";

  if (!/^[0-9a-f-]{36}$/.test(testId)) {
    return { ok: false, error: "Tes tidak valid." };
  }

  const supabase = await createClient();
  const session = await getSessionProfile();
  const { data: accessibleTest } = await supabase
    .from("tests")
    .select("created_by")
    .eq("id", testId)
    .maybeSingle();

  if (!accessibleTest) {
    return { ok: false, error: "Tes tidak ditemukan." };
  }

  if (
    !session ||
    (!isOwnerRole(session.profile.role) &&
      accessibleTest.created_by !== session.profile.id)
  ) {
    return { ok: false, error: "Hanya pemilik tes yang dapat mengubah soal." };
  }

  let options: unknown;
  try {
    options = JSON.parse(optionsRaw);
  } catch {
    return { ok: false, error: "Opsi jawaban tidak valid." };
  }

  const parsed = questionSchema.safeParse({
    section,
    prompt,
    options,
    correctLabel,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Data soal tidak valid.",
    };
  }

  let imagePath = removeImage ? null : existingImage || null;
  let audioPath = removeAudio ? null : existingAudio || null;
  const uploadedPaths: string[] = [];
  const replacedPaths: string[] = [];

  const imageFile = formData.get("image");
  if (imageFile instanceof File && imageFile.size > 0) {
    const uploaded = await uploadMedia(imageFile, "images");
    if (!uploaded.ok) return uploaded;
    if (imagePath) replacedPaths.push(imagePath);
    imagePath = uploaded.path;
    uploadedPaths.push(uploaded.path);
  }

  const audioFile = formData.get("audio");
  if (audioFile instanceof File && audioFile.size > 0) {
    const uploaded = await uploadMedia(audioFile, "audio");
    if (!uploaded.ok) return uploaded;
    if (audioPath) replacedPaths.push(audioPath);
    audioPath = uploaded.path;
    uploadedPaths.push(uploaded.path);
  }

  if (removeImage && existingImage) replacedPaths.push(existingImage);
  if (removeAudio && existingAudio) replacedPaths.push(existingAudio);

  if (parsed.data.section === "listening" && !audioPath) {
    await removeMedia(uploadedPaths);
    return { ok: false, error: "Soal Listening wajib memiliki audio." };
  }

  const { data, error } = await supabase.rpc("save_question", {
    p_test_id: testId,
    p_question_id: questionId,
    p_section: parsed.data.section,
    p_prompt: parsed.data.prompt,
    p_image_path: imagePath,
    p_audio_path: audioPath,
    p_options: parsed.data.options,
    p_correct_label: parsed.data.correctLabel,
  });

  if (error || !data) {
    await removeMedia(uploadedPaths);
    return {
      ok: false,
      error: errorMessage(error, "Gagal menyimpan soal. Coba lagi."),
    };
  }

  if (replacedPaths.length > 0) {
    await removeMedia(replacedPaths.filter((path) => path !== imagePath && path !== audioPath));
  }

  revalidatePath(`/admin/tests/${testId}`);
  revalidateTag(STORAGE_FILES_TAG, "max");
  return { ok: true, data: { questionId: data } };
}

export async function saveInteractiveQuestionAction(input: unknown): Promise<TestActionResult<{ questionId: string }>> {
  const denied = await guardStaff();
  if (denied) return denied;
  const envelope = z.object({ testId: z.string().uuid(), questionId: z.string().uuid().nullable().optional() }).safeParse(input);
  if (!envelope.success) return { ok: false, error: "Tes atau soal tidak valid." };
  const parsed = interactiveQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data soal tidak valid." };
  }

  const session = await getSessionProfile();
  const supabase = await createClient();
  const { data: test } = await supabase.from("tests").select("created_by").eq("id", envelope.data.testId).maybeSingle();
  if (!test) {
    return { ok: false, error: "Tes tidak ditemukan." };
  }
  if (!session || (!isOwnerRole(session.profile.role) && test.created_by !== session.profile.id)) {
    return { ok: false, error: "Hanya pemilik tes yang dapat mengubah soal." };
  }

  const { data, error } = await supabase.rpc("save_interactive_question", {
    p_test_id: envelope.data.testId,
    p_question_id: envelope.data.questionId ?? null,
    p_section: parsed.data.section,
    p_type: parsed.data.type,
    p_prompt: parsed.data.prompt,
    p_config: parsed.data.config,
    p_answer_key: parsed.data.answerKey,
  });
  if (error || !data) {
    return { ok: false, error: errorMessage(error, "Gagal menyimpan soal interaktif.") };
  }
  revalidatePath(`/admin/tests/${envelope.data.testId}`);
  return { ok: true, data: { questionId: data } };
}

export async function updateInteractiveQuestionAction(input: unknown): Promise<TestActionResult> {
  const denied = await guardStaff();
  if (denied) return denied;
  const parsed = interactiveQuestionSchema.safeParse(input);
  const envelope = z.object({ testId: z.string().uuid(), questionId: z.string().uuid() }).safeParse(input);
  if (!parsed.success || !envelope.success) {
    return { ok: false, error: parsed.success ? "Tes atau soal tidak valid." : parsed.error.issues[0]?.message ?? "Data soal tidak valid." };
  }
  const result = await saveInteractiveQuestionAction({ ...parsed.data, testId: envelope.data.testId, questionId: envelope.data.questionId });
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function updateInteractiveQuestionTextOnlyAction(input: unknown): Promise<TestActionResult> {
  const denied = await guardStaff();
  if (denied) return denied;
  const parsed = interactiveQuestionSchema.safeParse(input);
  const envelope = z.object({ testId: z.string().uuid(), questionId: z.string().uuid() }).safeParse(input);
  if (!parsed.success || !envelope.success) return { ok: false, error: "Data soal tidak valid." };

  const supabase = await createClient();
  const session = await getSessionProfile();
  const { data: test } = await supabase.from("tests").select("created_by").eq("id", envelope.data.testId).maybeSingle();
  if (!test || !session || (!isOwnerRole(session.profile.role) && test.created_by !== session.profile.id)) return { ok: false, error: "Akses ditolak." };
  const { data: question } = await supabase.from("questions").select("question_type, interaction_config").eq("id", envelope.data.questionId).eq("test_id", envelope.data.testId).maybeSingle();
  const { data: key } = await supabase.from("interactive_answer_keys").select("answer").eq("question_id", envelope.data.questionId).maybeSingle();
  if (!question || !key || question.question_type !== parsed.data.type) return { ok: false, error: "Tipe soal terkunci setelah ada pengerjaan." };

  const original = question.interaction_config as Record<string, unknown>;
  const next = parsed.data.config as Record<string, unknown>;
  const originalKey = key.answer as Record<string, unknown>;
  const nextKey = parsed.data.answerKey as Record<string, unknown>;
  if (JSON.stringify(original) !== JSON.stringify(next) || JSON.stringify(originalKey) !== JSON.stringify(nextKey)) {
    return { ok: false, error: "Struktur, opsi, dan kunci jawaban terkunci setelah ada pengerjaan." };
  }
  const { error } = await supabase.from("questions").update({ prompt: parsed.data.prompt }).eq("id", envelope.data.questionId).eq("test_id", envelope.data.testId);
  if (error) return { ok: false, error: "Gagal memperbarui teks soal." };
  revalidatePath(`/admin/tests/${envelope.data.testId}`);
  return { ok: true, data: undefined };
}

export async function saveInteractiveQuestionTextOnlyAction(input: unknown): Promise<TestActionResult> {
  const denied = await guardStaff();
  if (denied) return denied;
  const parsed = interactiveQuestionSchema.safeParse(input);
  const envelope = z.object({ testId: z.string().uuid(), questionId: z.string().uuid() }).safeParse(input);
  if (!parsed.success || !envelope.success) return { ok: false, error: "Data soal tidak valid." };

  const supabase = await createClient();
  const session = await getSessionProfile();
  const { data: accessible } = await supabase.from("tests").select("created_by").eq("id", envelope.data.testId).maybeSingle();
  if (!accessible || !session || (!isOwnerRole(session.profile.role) && accessible.created_by !== session.profile.id)) {
    return { ok: false, error: "Akses ditolak." };
  }
  const { data: existing } = await supabase.from("questions").select("question_type, interaction_config").eq("id", envelope.data.questionId).eq("test_id", envelope.data.testId).maybeSingle();
  if (!existing || existing.question_type !== parsed.data.type) return { ok: false, error: "Tipe soal terkunci setelah ada pengerjaan." };
  const config = parsed.data.config as Record<string, unknown>;
  const immutable = existing.interaction_config as Record<string, unknown>;
  if (JSON.stringify(config.leftItems) !== JSON.stringify(immutable.leftItems)
      || JSON.stringify(config.rightItems) !== JSON.stringify(immutable.rightItems)
      || JSON.stringify(config.choices) !== JSON.stringify(immutable.choices)
      || JSON.stringify(config.tokens) !== JSON.stringify(immutable.tokens)) {
    return { ok: false, error: "Struktur dan opsi soal terkunci setelah ada pengerjaan." };
  }

  const { error } = await supabase.from("questions").update({ prompt: parsed.data.prompt }).eq("id", envelope.data.questionId).eq("test_id", envelope.data.testId);
  if (error) return { ok: false, error: "Gagal memperbarui teks soal." };
  revalidatePath(`/admin/tests/${envelope.data.testId}`);
  return { ok: true, data: undefined };
}

export async function saveImportedQuestionAction(input: {
  testId: string;
  prompt: string;
  options: { label: string; text: string }[];
  correctLabel: string;
}): Promise<TestActionResult<{ questionId: string }>> {
  const denied = await guardStaff();
  if (denied) return denied;

  const parsedTestId = z.string().uuid().safeParse(input.testId);
  if (!parsedTestId.success) return { ok: false, error: "Tes tidak valid." };

  const parsed = questionSchema.safeParse({
    section: "reading",
    prompt: input.prompt,
    options: input.options,
    correctLabel: input.correctLabel,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Data soal tidak valid.",
    };
  }

  const supabase = await createClient();
  const session = await getSessionProfile();
  const { data: accessibleTest } = await supabase
    .from("tests")
    .select("created_by")
    .eq("id", parsedTestId.data)
    .maybeSingle();

  if (!accessibleTest) return { ok: false, error: "Tes tidak ditemukan." };
  if (
    !session ||
    (!isOwnerRole(session.profile.role) && accessibleTest.created_by !== session.profile.id)
  ) {
    return { ok: false, error: "Hanya pemilik tes yang dapat mengubah soal." };
  }

  const { data, error } = await supabase.rpc("save_question", {
    p_test_id: parsedTestId.data,
    p_question_id: null,
    p_section: "reading",
    p_prompt: parsed.data.prompt,
    p_image_path: null,
    p_audio_path: null,
    p_options: parsed.data.options,
    p_correct_label: parsed.data.correctLabel,
  });

  if (error || !data) {
    return {
      ok: false,
      error: errorMessage(error, "Gagal menyimpan soal impor. Coba lagi."),
    };
  }

  revalidatePath(`/admin/tests/${parsedTestId.data}`);
  return { ok: true, data: { questionId: data } };
}

export async function updateQuestionTextAction(
  formData: FormData,
): Promise<TestActionResult> {
  const denied = await guardStaff();
  if (denied) return denied;

  let options: unknown;
  try {
    options = JSON.parse(String(formData.get("options") ?? "[]"));
  } catch {
    return { ok: false, error: "Teks opsi jawaban tidak valid." };
  }

  const parsed = questionTextUpdateSchema.safeParse({
    testId: formData.get("testId"),
    questionId: formData.get("questionId"),
    prompt: formData.get("prompt"),
    options,
    correctLabel: formData.get("correctLabel"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Teks soal tidak valid.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_question_text", {
    p_test_id: parsed.data.testId,
    p_question_id: parsed.data.questionId,
    p_prompt: parsed.data.prompt,
    p_options: parsed.data.options,
    p_correct_label: parsed.data.correctLabel,
  });
  if (error) {
    return {
      ok: false,
      error: errorMessage(error, "Gagal menyimpan perubahan teks soal."),
    };
  }

  revalidatePath(`/admin/tests/${parsed.data.testId}`);
  revalidatePath(`/admin/tests/${parsed.data.testId}/questions/${parsed.data.questionId}`);
  return { ok: true, data: undefined };
}

export async function updateQuestionInteractionAction(input: unknown): Promise<TestActionResult> {
  const denied = await guardStaff();
  if (denied) return denied;
  const parsed = questionInteractionUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data soal tidak valid." };
  const result = await saveInteractiveQuestionAction({ ...parsed.data, questionId: parsed.data.questionId });
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function moveQuestionAction(
  questionId: string,
  direction: -1 | 1,
): Promise<TestActionResult> {
  const denied = await guardStaff();
  if (denied) return denied;

  const supabase = await createClient();
  const { data: question } = await supabase
    .from("questions")
    .select("test_id")
    .eq("id", questionId)
    .maybeSingle();

  if (!question) return { ok: false, error: "Soal tidak ditemukan." };

  const { error } = await supabase.rpc("move_question", {
    p_question_id: questionId,
    p_direction: direction,
  });

  if (error) {
    return { ok: false, error: errorMessage(error, "Gagal mengubah urutan soal.") };
  }

  revalidatePath(`/admin/tests/${question.test_id}`);
  return { ok: true, data: undefined };
}

export async function deleteQuestionAction(
  questionId: string,
): Promise<TestActionResult> {
  const denied = await guardStaff();
  if (denied) return denied;

  const supabase = await createClient();
  const { data: question } = await supabase
    .from("questions")
    .select("test_id, image_path, audio_path")
    .eq("id", questionId)
    .maybeSingle();

  if (!question) return { ok: false, error: "Soal tidak ditemukan." };

  const { error } = await supabase.rpc("delete_question", {
    p_question_id: questionId,
  });

  if (error) {
    return { ok: false, error: errorMessage(error, "Gagal menghapus soal.") };
  }

  const orphans = [question.image_path, question.audio_path].filter(
    (path): path is string => Boolean(path),
  );
  await removeMedia(orphans);

  revalidatePath(`/admin/tests/${question.test_id}`);
  revalidateTag(STORAGE_FILES_TAG, "max");
  return { ok: true, data: undefined };
}

export async function deleteTestAction(
  testId: string,
): Promise<TestActionResult> {
  const denied = await guardStaff();
  if (denied) return denied;

  if (!/^[0-9a-f-]{36}$/.test(testId)) {
    return { ok: false, error: "Tes tidak valid." };
  }

  const session = await getSessionProfile();
  const supabase = await createClient();
  const { data: test } = await supabase
    .from("tests")
    .select("id, title, created_by")
    .eq("id", testId)
    .maybeSingle();

  if (!test) return { ok: false, error: "Tes tidak ditemukan." };
  if (
    !session ||
    (!isOwnerRole(session.profile.role) && test.created_by !== session.profile.id)
  ) {
    return { ok: false, error: "Hanya pemilik tes yang dapat menghapus tes ini." };
  }

  const { count: attemptCount } = await supabase
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("test_id", testId);

  if ((attemptCount ?? 0) > 0) {
    return {
      ok: false,
      error: "Tes tidak dapat dihapus karena sudah ada pengerjaan.",
    };
  }

  const { data: questions } = await supabase
    .from("questions")
    .select("image_path, audio_path")
    .eq("test_id", testId);

  const mediaPaths = (questions ?? [])
    .flatMap((question) => [question.image_path, question.audio_path])
    .filter((path): path is string => Boolean(path));

  const { data: deleted, error } = await supabase
    .from("tests")
    .delete()
    .eq("id", testId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: errorMessage(error, "Gagal menghapus tes.") };
  }

  if (!deleted) {
    return { ok: false, error: "Gagal menghapus tes. Coba lagi." };
  }

  await removeMedia(mediaPaths);

  revalidatePath("/admin/tests");
  revalidatePath("/admin");
  return { ok: true, data: undefined };
}

export async function duplicateTestAction(
  testId: string,
): Promise<TestActionResult<{ id: string }>> {
  const denied = await guardStaff();
  if (denied) return denied;

  if (!/^[0-9a-f-]{36}$/.test(testId)) {
    return { ok: false, error: "Tes tidak valid." };
  }

  const accessClient = await createClient();
  const { data: accessibleTest } = await accessClient
    .from("tests")
    .select("created_by")
    .eq("id", testId)
    .maybeSingle();

  if (!accessibleTest) {
    return { ok: false, error: "Tes tidak ditemukan." };
  }

  const session = await getSessionProfile();
  if (
    !session ||
    (!isOwnerRole(session.profile.role) &&
      accessibleTest.created_by !== session.profile.id)
  ) {
    return {
      ok: false,
      error: "Hanya pemilik tes yang dapat menduplikat tes ini.",
    };
  }

  const admin = createAdminClient();
  const { data: questions, error } = await admin
    .from("questions")
    .select("image_path, audio_path")
    .eq("test_id", testId);

  if (error) return { ok: false, error: "Gagal membaca soal tes." };

  const mediaMap: Record<string, string> = {};
  const createdCopies: string[] = [];

  for (const question of questions ?? []) {
    for (const path of [question.image_path, question.audio_path]) {
      if (!path || mediaMap[path]) continue;
      const copy = await copyMedia(path);
      if (!copy) {
        await removeMedia(createdCopies);
        return {
          ok: false,
          error: "Gagal menyalin media tes. Coba lagi.",
        };
      }
      mediaMap[path] = copy;
      createdCopies.push(copy);
    }
  }

  const supabase = await createClient();
  const { data, error: duplicateError } = await supabase.rpc("duplicate_test", {
    p_test_id: testId,
    p_media_map: mediaMap,
  });

  if (duplicateError || !data) {
    await removeMedia(createdCopies);
    return {
      ok: false,
      error: errorMessage(duplicateError, "Gagal menduplikat tes."),
    };
  }

  revalidatePath("/admin/tests");
  return { ok: true, data: { id: data } };
}

export async function setTestAssignmentsAction(
  input: unknown,
): Promise<TestActionResult> {
  const denied = await guardOwner();
  if (denied) return denied;

  const parsed = setTestAssignmentsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data penugasan tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_test_assignments", {
    p_test_id: parsed.data.testId,
    p_teacher_ids: parsed.data.teacherIds,
  });

  if (error) {
    return {
      ok: false,
      error: errorMessage(error, "Gagal menyimpan penugasan tes."),
    };
  }

  revalidatePath("/admin/tests");
  revalidatePath(`/admin/tests/${parsed.data.testId}`);
  revalidatePath("/admin/teachers");
  revalidatePath("/admin");
  return { ok: true, data: undefined };
}

export type TestRowData = Tables<"tests">;

type PdfKind = "teacher" | "student";

async function managedTest(testId: string) {
  const session = await getSessionProfile();
  if (!session) return { ok: false as const, error: "Akses ditolak." };
  const supabase = await createClient();
  const { data: test } = await supabase
    .from("tests")
    .select("id, created_by, pdf_path, student_pdf_path")
    .eq("id", testId)
    .maybeSingle();
  if (!test) return { ok: false as const, error: "Tes tidak ditemukan." };
  if (!isOwnerRole(session.profile.role) && test.created_by !== session.profile.id) {
    return { ok: false as const, error: "Hanya pemilik tes yang dapat mengubah PDF dan soal." };
  }
  return { ok: true as const, supabase, test };
}

async function setTestPdfPath(
  supabase: Awaited<ReturnType<typeof createClient>>,
  testId: string,
  kind: PdfKind,
  path: string | null,
) {
  return kind === "student"
    ? supabase.from("tests").update({ student_pdf_path: path }).eq("id", testId)
    : supabase.from("tests").update({ pdf_path: path }).eq("id", testId);
}

export async function uploadTestPdfAction(
  testId: string,
  file: File,
  kind: PdfKind = "teacher",
): Promise<TestActionResult<{ path: string; url: string | null }>> {
  const denied = await guardStaff();
  if (denied) return denied;
  const parsedId = z.string().uuid().safeParse(testId);
  if (!parsedId.success || !(file instanceof File)) {
    return { ok: false, error: "Data PDF tidak valid." };
  }
  if (kind !== "teacher" && kind !== "student") {
    return { ok: false, error: "Jenis PDF tidak valid." };
  }

  const managed = await managedTest(parsedId.data);
  if (!managed.ok) return { ok: false, error: managed.error };

  const uploaded = await uploadQuestionPdf(file, parsedId.data);
  if (!uploaded.ok) return uploaded;

  const previous = kind === "student" ? managed.test.student_pdf_path : managed.test.pdf_path;
  const { error } = await setTestPdfPath(
    managed.supabase,
    parsedId.data,
    kind,
    uploaded.path,
  );
  if (error) {
    console.error("[tests] gagal menautkan PDF", error);
    await removeMedia([uploaded.path]);
    return {
      ok: false,
      error:
        error.message.includes("does not exist")
          ? "Kolom PDF belum tersedia. Terapkan migration 0007 terlebih dahulu."
          : "Gagal menautkan PDF ke tes.",
    };
  }
  if (previous && previous !== uploaded.path) {
    await removeMedia([previous]);
  }
  revalidatePath(`/admin/tests/${parsedId.data}`);
  return {
    ok: true,
    data: { path: uploaded.path, url: await signMedia(uploaded.path, 3600) },
  };
}

export async function removeTestPdfAction(
  testId: string,
  kind: PdfKind,
): Promise<TestActionResult> {
  const denied = await guardStaff();
  if (denied) return denied;
  const parsedId = z.string().uuid().safeParse(testId);
  if (!parsedId.success || (kind !== "teacher" && kind !== "student")) {
    return { ok: false, error: "Data PDF tidak valid." };
  }
  const managed = await managedTest(parsedId.data);
  if (!managed.ok) return { ok: false, error: managed.error };

  const previous = kind === "student" ? managed.test.student_pdf_path : managed.test.pdf_path;
  const { error } = await setTestPdfPath(managed.supabase, parsedId.data, kind, null);
  if (error) return { ok: false, error: "Gagal menghapus tautan PDF." };
  if (previous) await removeMedia([previous]);
  revalidatePath(`/admin/tests/${parsedId.data}`);
  return { ok: true, data: undefined };
}

async function ensureTeacherPdf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  testId: string,
): Promise<{ ok: true; pdfPath: string } | { ok: false; error: string }> {
  const { data: test } = await supabase
    .from("tests")
    .select("pdf_path")
    .eq("id", testId)
    .maybeSingle();
  if (!test?.pdf_path) {
    return { ok: false, error: "Unggah PDF guru terlebih dahulu." };
  }
  return { ok: true, pdfPath: test.pdf_path };
}

export async function savePdfChoiceQuestionAction(
  input: unknown,
): Promise<TestActionResult<{ questionId: string }>> {
  const denied = await guardStaff();
  if (denied) return denied;
  const parsed = pdfChoiceQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data soal PDF tidak valid." };
  }
  const managed = await managedTest(parsed.data.testId);
  if (!managed.ok) return { ok: false, error: managed.error };
  const pdf = await ensureTeacherPdf(managed.supabase, parsed.data.testId);
  if (!pdf.ok) return pdf;

  const labels = parsed.data.options.map((option) => option.label);
  const overlayLabels = parsed.data.overlays.map((overlay) => overlay.label ?? overlay.id);
  if (
    !labels.includes(parsed.data.correctLabel) ||
    parsed.data.overlays.length !== labels.length ||
    new Set(overlayLabels).size !== labels.length ||
    overlayLabels.some((label) => !labels.includes(label))
  ) {
    return { ok: false, error: "Setiap opsi harus memiliki tepat satu lingkaran dan satu kunci benar." };
  }

  const { data: questionId, error } = await managed.supabase.rpc("save_question", {
    p_test_id: parsed.data.testId,
    p_question_id: null,
    p_section: parsed.data.section,
    p_prompt: parsed.data.prompt,
    p_image_path: null,
    p_audio_path: null,
    p_options: parsed.data.options,
    p_correct_label: parsed.data.correctLabel,
  });
  if (error || !questionId) {
    return { ok: false, error: errorMessage(error, "Gagal menyimpan soal PDF.") };
  }

  const { error: configError } = await managed.supabase
    .from("questions")
    .update({
      interaction_config: {
        pdf: true,
        overlays: parsed.data.overlays,
      } as Json,
    })
    .eq("id", questionId);
  if (configError) {
    await managed.supabase.rpc("delete_question", { p_question_id: questionId });
    return { ok: false, error: "Gagal menyimpan posisi lingkaran opsi." };
  }
  revalidatePath(`/admin/tests/${parsed.data.testId}`);
  return { ok: true, data: { questionId } };
}

export async function savePdfBlankQuestionsAction(
  input: unknown,
): Promise<TestActionResult<{ questionIds: string[] }>> {
  const denied = await guardStaff();
  if (denied) return denied;
  const parsed = pdfBlankQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data isian PDF tidak valid." };
  }
  const managed = await managedTest(parsed.data.testId);
  if (!managed.ok) return { ok: false, error: managed.error };
  const pdf = await ensureTeacherPdf(managed.supabase, parsed.data.testId);
  if (!pdf.ok) return pdf;

  const labels = new Set(parsed.data.choices.map((choice) => choice.label));
  for (const blank of parsed.data.blanks) {
    if (!labels.has(blank.correctLabel)) {
      return { ok: false, error: `Kunci untuk ${blank.prompt} belum dipilih dari opsi yang tersedia.` };
    }
    if (blank.overlay.kind !== "blank") {
      return { ok: false, error: "Titik kosong harus berupa penanda isian." };
    }
  }

  const created: string[] = [];
  for (const blank of parsed.data.blanks) {
    const { data, error } = await managed.supabase.rpc("save_interactive_question", {
      p_test_id: parsed.data.testId,
      p_question_id: null,
      p_section: parsed.data.section,
      p_type: "hanzi_blank",
      p_prompt: blank.prompt,
      p_config: {
        choices: parsed.data.choices,
        blankCount: 1,
        pdf: true,
        overlays: [blank.overlay],
      } as Json,
      p_answer_key: { correctLabel: blank.correctLabel } as Json,
    });
    if (error || !data) {
      for (const id of created) {
        await managed.supabase.rpc("delete_question", { p_question_id: id });
      }
      return { ok: false, error: errorMessage(error, "Gagal menyimpan isian PDF.") };
    }
    created.push(data);
  }
  revalidatePath(`/admin/tests/${parsed.data.testId}`);
  return { ok: true, data: { questionIds: created } };
}

export async function savePdfMatchingQuestionAction(
  input: unknown,
): Promise<TestActionResult<{ questionId: string }>> {
  const denied = await guardStaff();
  if (denied) return denied;
  const parsed = pdfMatchingQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data matching PDF tidak valid." };
  }
  const managed = await managedTest(parsed.data.testId);
  if (!managed.ok) return { ok: false, error: managed.error };
  const pdf = await ensureTeacherPdf(managed.supabase, parsed.data.testId);
  if (!pdf.ok) return pdf;

  const leftIds = new Set(parsed.data.leftItems.map((item) => item.id));
  const overlayIds = parsed.data.overlays.map((overlay) => overlay.id);
  if (
    overlayIds.length !== leftIds.size ||
    new Set(overlayIds).size !== leftIds.size ||
    overlayIds.some((id) => !leftIds.has(id)) ||
    parsed.data.overlays.some((overlay) => overlay.kind !== "match")
  ) {
    return { ok: false, error: "Setiap nomor matching harus memiliki tepat satu penanda." };
  }
  if (
    Object.keys(parsed.data.matches).length !== parsed.data.leftItems.length ||
    new Set(Object.values(parsed.data.matches)).size !== parsed.data.leftItems.length
  ) {
    return { ok: false, error: "Kunci matching harus memasangkan semua nomor." };
  }

  const { data, error } = await managed.supabase.rpc("save_interactive_question", {
    p_test_id: parsed.data.testId,
    p_question_id: null,
    p_section: parsed.data.section,
    p_type: "matching",
    p_prompt: parsed.data.prompt,
    p_config: {
      leftItems: parsed.data.leftItems,
      rightItems: parsed.data.rightItems,
      pdf: true,
      overlays: parsed.data.overlays,
    } as Json,
    p_answer_key: { matches: parsed.data.matches } as Json,
  });
  if (error || !data) {
    return { ok: false, error: errorMessage(error, "Gagal menyimpan matching PDF.") };
  }
  revalidatePath(`/admin/tests/${parsed.data.testId}`);
  return { ok: true, data: { questionId: data } };
}

export async function savePdfRearrangeQuestionAction(
  input: unknown,
): Promise<TestActionResult<{ questionId: string }>> {
  const denied = await guardStaff();
  if (denied) return denied;
  const parsed = pdfRearrangeQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data susun kalimat PDF tidak valid." };
  }
  const managed = await managedTest(parsed.data.testId);
  if (!managed.ok) return { ok: false, error: managed.error };
  const pdf = await ensureTeacherPdf(managed.supabase, parsed.data.testId);
  if (!pdf.ok) return pdf;

  const tokenIds = parsed.data.tokens.map((token) => token.id);
  if (
    parsed.data.order.length !== tokenIds.length ||
    new Set(parsed.data.order).size !== tokenIds.length ||
    parsed.data.order.some((id) => !tokenIds.includes(id))
  ) {
    return { ok: false, error: "Urutan kunci harus memakai setiap potongan tepat satu kali." };
  }
  if (parsed.data.overlays.some((overlay) => overlay.kind !== "drop")) {
    return { ok: false, error: "Penanda susun kalimat tidak valid." };
  }

  const { data, error } = await managed.supabase.rpc("save_interactive_question", {
    p_test_id: parsed.data.testId,
    p_question_id: null,
    p_section: parsed.data.section,
    p_type: "rearrange_sentence",
    p_prompt: parsed.data.prompt,
    p_config: {
      tokens: parsed.data.tokens,
      pdf: true,
      overlays: parsed.data.overlays,
    } as Json,
    p_answer_key: { order: parsed.data.order } as Json,
  });
  if (error || !data) {
    return { ok: false, error: errorMessage(error, "Gagal menyimpan susun kalimat PDF.") };
  }
  revalidatePath(`/admin/tests/${parsed.data.testId}`);
  return { ok: true, data: { questionId: data } };
}
