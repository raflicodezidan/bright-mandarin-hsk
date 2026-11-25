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

  const rawOptions = options;
  const parsed = questionSchema.safeParse({
    section,
    prompt,
    options: (Array.isArray(rawOptions) ? rawOptions : []).map((value) => {
      const option = value as { label?: string; text?: string; imagePath?: string | null };
      return { label: option.label ?? "", text: option.text || (option.imagePath ? `Gambar opsi ${option.label ?? ""}` : ""), imagePath: option.imagePath };
    }),
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
  const parsedOptions = parsed.data.options.map((option) => ({ ...option }));
  for (const option of parsedOptions) {
    const imageFile = formData.get(`optionImage:${option.label}`);
    if (!(imageFile instanceof File) || imageFile.size === 0) continue;
    const uploaded = await uploadMedia(imageFile, "images");
    if (!uploaded.ok) {
      await removeMedia(uploadedPaths);
      return uploaded;
    }
    uploadedPaths.push(uploaded.path);
    (option as { imagePath?: string }).imagePath = uploaded.path;
  }

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
    const { data: testAudio } = await supabase.from("tests").select("listening_audio_path").eq("id", testId).maybeSingle();
    if (!testAudio?.listening_audio_path) {
      await removeMedia(uploadedPaths);
      return { ok: false, error: "Soal Listening wajib memiliki audio khusus atau audio bersama tes." };
    }
    audioPath = testAudio.listening_audio_path;
  }

  const { data, error } = await supabase.rpc("save_question", {
    p_test_id: testId,
    p_question_id: questionId,
    p_section: parsed.data.section,
    p_prompt: parsed.data.prompt,
    p_image_path: imagePath,
    p_audio_path: audioPath,
    p_options: parsedOptions,
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
  options: { label: string; text: string; imageDataUrl?: string | null; imagePath?: string | null }[];
  correctLabel: string;
}): Promise<TestActionResult<{ questionId: string }>> {
  const denied = await guardStaff();
  if (denied) return denied;

  const parsedTestId = z.string().uuid().safeParse(input.testId);
  if (!parsedTestId.success) return { ok: false, error: "Tes tidak valid." };

  const parsed = questionSchema.safeParse({
    section: "reading",
    prompt: input.prompt,
    options: input.options.map(({ label, text, imageDataUrl, imagePath }) => ({ label, text: text || (imageDataUrl || imagePath ? `Gambar opsi ${label}` : ""), imagePath })),
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

  const optionImageFiles = parsed.data.options.map((option, index) => ({ ...option, imageDataUrl: input.options[index]?.imageDataUrl ?? null }));
  const uploadedOptionImages: string[] = [];
  for (const option of optionImageFiles) {
    const dataUrl = option.imageDataUrl;
    if (!dataUrl) continue;
    const match = dataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return { ok: false, error: "Data gambar OCR tidak valid." };
    const mime = match[1] === "jpeg" ? "image/jpeg" : `image/${match[1]}`;
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.byteLength > 2 * 1024 * 1024) return { ok: false, error: "Gambar opsi maksimal 2 MB." };
    const uploaded = await uploadMedia(new File([bytes], `option-${option.label}.${match[1]}`, { type: mime }), "images");
    if (!uploaded.ok) {
      await removeMedia(uploadedOptionImages);
      return uploaded;
    }
    uploadedOptionImages.push(uploaded.path);
    (option as { imagePath?: string }).imagePath = uploaded.path;
    (option as { imageDataUrl?: string }).imageDataUrl = undefined;
  }

  const { data, error } = await supabase.rpc("save_question", {
    p_test_id: parsedTestId.data,
    p_question_id: null,
    p_section: "reading",
    p_prompt: parsed.data.prompt,
    p_image_path: null,
    p_audio_path: null,
    p_options: optionImageFiles.map((option) => {
      const imagePath = (option as { imagePath?: string }).imagePath;
      return { label: option.label, text: option.text || `Gambar opsi ${option.label}`, image_path: imagePath };
    }),
    p_correct_label: parsed.data.correctLabel,
  });

  if (error || !data) {
    await removeMedia(uploadedOptionImages);
    return {
      ok: false,
      error: errorMessage(error, "Gagal menyimpan soal impor. Coba lagi."),
    };
  }

  if (uploadedOptionImages.length) revalidateTag(STORAGE_FILES_TAG, "max");

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

  const { data: optionRows } = await supabase.from("question_options").select("image_path").eq("question_id", questionId);
  const { error } = await supabase.rpc("delete_question", {
    p_question_id: questionId,
  });
  if (error) return { ok: false, error: errorMessage(error, "Gagal menghapus soal.") };
  const orphans = [question.image_path, question.audio_path, ...(optionRows ?? []).map((option) => option.image_path)].filter(
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

  const { data: testMedia } = await supabase.from("tests").select("pdf_path, student_pdf_path, listening_audio_path").eq("id", testId).maybeSingle();
  const { data: questions } = await supabase
    .from("questions")
    .select("id, image_path, audio_path")
    .eq("test_id", testId);

  const questionIds = (questions ?? []).map((question) => question.id);
  const { data: optionImages } = await supabase.from("question_options").select("image_path").in("question_id", questionIds.length ? questionIds : ["00000000-0000-0000-0000-000000000000"]);

  const mediaPaths = (questions ?? [])
    .flatMap((question) => [question.image_path, question.audio_path])
    .filter((path): path is string => Boolean(path));
  const testPaths = [testMedia?.pdf_path, testMedia?.student_pdf_path, testMedia?.listening_audio_path, ...(optionImages ?? []).map((option) => option.image_path)].filter((path): path is string => Boolean(path));

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

  await removeMedia([...new Set([...mediaPaths, ...testPaths])]);

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
  const { data: sourceTest } = await admin
    .from("tests")
    .select("listening_audio_path")
    .eq("id", testId)
    .maybeSingle();

  const { data: questions, error } = await admin
    .from("questions")
    .select("image_path, audio_path, interaction_config")
    .eq("test_id", testId);

  if (error) return { ok: false, error: "Gagal membaca soal tes." };

  const mediaMap: Record<string, string> = {};
  const createdCopies: string[] = [];

  for (const question of questions ?? []) {
    const config = question.interaction_config as { pdf?: boolean } | null;
    for (const path of [question.image_path, config?.pdf ? null : question.audio_path]) {
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
  if (sourceTest?.listening_audio_path && !mediaMap[sourceTest.listening_audio_path]) {
    const copy = await copyMedia(sourceTest.listening_audio_path);
    if (!copy) {
      await removeMedia(createdCopies);
      return { ok: false, error: "Gagal menyalin audio Listening bersama." };
    }
    mediaMap[sourceTest.listening_audio_path] = copy;
    createdCopies.push(copy);
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

export async function uploadListeningAudioAction(
  testId: string,
  file: File,
): Promise<TestActionResult<{ path: string }>> {
  const denied = await guardStaff();
  if (denied) return denied;
  const parsedId = z.string().uuid().safeParse(testId);
  if (!parsedId.success || !(file instanceof File)) {
    return { ok: false, error: "Data audio tidak valid." };
  }
  const managed = await managedTest(parsedId.data);
  if (!managed.ok) return { ok: false, error: managed.error };
  const attemptCheck = await managed.supabase.from("attempts").select("id", { count: "exact", head: true }).eq("test_id", parsedId.data);
  if ((attemptCheck.count ?? 0) > 0) return { ok: false, error: "Audio bersama tidak dapat diubah setelah tes memiliki pengerjaan." };

  const uploaded = await uploadMedia(file, "audio");
  if (!uploaded.ok) return uploaded;
  const previous = managed.test.listening_audio_path;
  const { error } = await managed.supabase
    .from("tests")
    .update({ listening_audio_path: uploaded.path })
    .eq("id", parsedId.data);
  if (error) {
    await removeMedia([uploaded.path]);
    return { ok: false, error: "Gagal menyimpan audio Listening bersama." };
  }
  if (previous && previous !== uploaded.path) {
    const stillUsed = await managed.supabase.from("questions").select("id", { count: "exact", head: true }).eq("audio_path", previous);
    if ((stillUsed.count ?? 0) === 0) await removeMedia([previous]);
  }
  revalidatePath(`/admin/tests/${parsedId.data}`);
  return { ok: true, data: { path: uploaded.path } };
}

export async function removeListeningAudioAction(
  testId: string,
): Promise<TestActionResult> {
  const denied = await guardStaff();
  if (denied) return denied;
  const parsedId = z.string().uuid().safeParse(testId);
  if (!parsedId.success) return { ok: false, error: "Tes tidak valid." };
  const managed = await managedTest(parsedId.data);
  if (!managed.ok) return { ok: false, error: managed.error };
  const attemptCheck = await managed.supabase.from("attempts").select("id", { count: "exact", head: true }).eq("test_id", parsedId.data);
  if ((attemptCheck.count ?? 0) > 0) return { ok: false, error: "Audio bersama tidak dapat diubah setelah tes memiliki pengerjaan." };

  const previous = managed.test.listening_audio_path;
  const { error } = await managed.supabase
    .from("tests")
    .update({ listening_audio_path: null })
    .eq("id", parsedId.data);
  if (error) return { ok: false, error: "Gagal menghapus audio Listening bersama." };
  if (previous) {
    const stillUsed = await managed.supabase.from("questions").select("id", { count: "exact", head: true }).eq("audio_path", previous);
    if ((stillUsed.count ?? 0) === 0) await removeMedia([previous]);
  }
  revalidatePath(`/admin/tests/${parsedId.data}`);
  return { ok: true, data: undefined };
}

async function managedTest(testId: string) {
  const session = await getSessionProfile();
  if (!session) return { ok: false as const, error: "Akses ditolak." };
  const supabase = await createClient();
  const { data: test } = await supabase
    .from("tests")
    .select("id, created_by, pdf_path, student_pdf_path, listening_audio_path")
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

  const choiceOptions = parsed.data.options.map((option) => ({ ...option, imageDataUrl: (option as { imageDataUrl?: string }).imageDataUrl }));
  const uploadedOptionImages: string[] = [];
  for (const option of choiceOptions) {
    const dataUrl = option.imageDataUrl;
    if (!dataUrl) continue;
    const match = dataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return { ok: false, error: "Gambar opsi tidak valid." };
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.byteLength > 2 * 1024 * 1024) return { ok: false, error: "Gambar opsi maksimal 2 MB." };
    const type = match[1] === "jpeg" ? "image/jpeg" : `image/${match[1]}`;
    const upload = await uploadMedia(new File([bytes], `option-${option.label}.${match[1]}`, { type }), "images");
    if (!upload.ok) {
      await removeMedia(uploadedOptionImages);
      return upload;
    }
    uploadedOptionImages.push(upload.path);
    (option as { imagePath?: string }).imagePath = upload.path;
    (option as { imageDataUrl?: string }).imageDataUrl = undefined;
  }

  let questionAudioPath: string | null = null;
  if (parsed.data.section === "listening") {
    const { data: testAudio } = await managed.supabase
      .from("tests")
      .select("listening_audio_path")
      .eq("id", parsed.data.testId)
      .maybeSingle();
    questionAudioPath = testAudio?.listening_audio_path ?? null;
    if (!questionAudioPath) {
      await removeMedia(uploadedOptionImages);
      return { ok: false, error: "Unggah audio Listening bersama atau buat soal dengan audio per-soal." };
    }
  }

  const { data: questionId, error } = await managed.supabase.rpc("save_question", {
    p_test_id: parsed.data.testId,
    p_question_id: null,
    p_section: parsed.data.section,
    p_prompt: parsed.data.prompt,
    p_image_path: null,
    p_audio_path: questionAudioPath,
    p_options: choiceOptions.map((option) => ({ label: option.label, text: option.text || `Gambar opsi ${option.label}`, image_path: option.imagePath })),
    p_correct_label: parsed.data.correctLabel,
  });
  if (error || !questionId) {
    await removeMedia(uploadedOptionImages);
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
    await removeMedia(uploadedOptionImages);
    return { ok: false, error: "Gagal menyimpan posisi lingkaran opsi." };
  }
  if (uploadedOptionImages.length) revalidateTag(STORAGE_FILES_TAG, "max");
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
  let listeningAudioPath: string | null = null;
  if (parsed.data.section === "listening") {
    const { data: testAudio } = await managed.supabase.from("tests").select("listening_audio_path").eq("id", parsed.data.testId).maybeSingle();
    listeningAudioPath = testAudio?.listening_audio_path ?? null;
    if (!listeningAudioPath) return { ok: false, error: "Unggah audio Listening bersama atau buat soal dengan audio per-soal." };
  }

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
    if (listeningAudioPath) {
      const { error: audioLinkError } = await managed.supabase.from("questions").update({ audio_path: listeningAudioPath }).eq("id", data);
      if (audioLinkError) {
        await managed.supabase.rpc("delete_question", { p_question_id: data });
        for (const id of created) await managed.supabase.rpc("delete_question", { p_question_id: id });
        return { ok: false, error: "Gagal memasangkan audio Listening bersama." };
      }
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
  let listeningAudioPath: string | null = null;
  if (parsed.data.section === "listening") {
    const { data: testAudio } = await managed.supabase.from("tests").select("listening_audio_path").eq("id", parsed.data.testId).maybeSingle();
    listeningAudioPath = testAudio?.listening_audio_path ?? null;
    if (!listeningAudioPath) return { ok: false, error: "Unggah audio Listening bersama atau buat soal dengan audio per-soal." };
  }

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
  if (listeningAudioPath) {
    const { error: audioLinkError } = await managed.supabase.from("questions").update({ audio_path: listeningAudioPath }).eq("id", data);
    if (audioLinkError) {
      await managed.supabase.rpc("delete_question", { p_question_id: data });
      return { ok: false, error: "Gagal memasangkan audio Listening bersama." };
    }
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
  let listeningAudioPath: string | null = null;
  if (parsed.data.section === "listening") {
    const { data: testAudio } = await managed.supabase.from("tests").select("listening_audio_path").eq("id", parsed.data.testId).maybeSingle();
    listeningAudioPath = testAudio?.listening_audio_path ?? null;
    if (!listeningAudioPath) return { ok: false, error: "Unggah audio Listening bersama atau buat soal dengan audio per-soal." };
  }

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
  if (listeningAudioPath) {
    const { error: audioLinkError } = await managed.supabase.from("questions").update({ audio_path: listeningAudioPath }).eq("id", data);
    if (audioLinkError) {
      await managed.supabase.rpc("delete_question", { p_question_id: data });
      return { ok: false, error: "Gagal memasangkan audio Listening bersama." };
    }
  }
  revalidatePath(`/admin/tests/${parsed.data.testId}`);
  return { ok: true, data: { questionId: data } };
}
