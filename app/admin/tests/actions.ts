"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  copyMedia,
  removeMedia,
  uploadMedia,
} from "@/lib/storage";
import {
  questionSchema,
  testSchema,
  testStatusSchema,
} from "@/lib/validation/tests";
import type { Tables } from "@/lib/supabase/database.types";

export type TestActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function guardAdmin(): Promise<{ ok: false; error: string } | null> {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "admin" || !session.profile.is_active) {
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
  const denied = await guardAdmin();
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
  const denied = await guardAdmin();
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

  const supabase = await createClient();
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
  const denied = await guardAdmin();
  if (denied) return denied;

  const parsed = testStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const supabase = await createClient();
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
  const denied = await guardAdmin();
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

  const supabase = await createClient();
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
  return { ok: true, data: { questionId: data } };
}

export async function moveQuestionAction(
  questionId: string,
  direction: -1 | 1,
): Promise<TestActionResult> {
  const denied = await guardAdmin();
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
  const denied = await guardAdmin();
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
  return { ok: true, data: undefined };
}

export async function duplicateTestAction(
  testId: string,
): Promise<TestActionResult<{ id: string }>> {
  const denied = await guardAdmin();
  if (denied) return denied;

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

export type TestRowData = Tables<"tests">;
