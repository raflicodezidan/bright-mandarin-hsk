"use server";

import { z } from "zod";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { databaseErrorMessage } from "@/lib/errors";

export type StudentActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function guardStudent(): Promise<{ ok: false; error: string } | null> {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "student" || !session.profile.is_active) {
    return { ok: false, error: "Akses ditolak." };
  }
  return null;
}

const uuid = z.string().uuid();

export async function startTestAction(
  testId: string,
): Promise<
  StudentActionResult<{ attemptId: string; expiresAt: string; serverNow: string }>
> {
  const denied = await guardStudent();
  if (denied) return denied;
  if (!uuid.safeParse(testId).success) {
    return { ok: false, error: "Tes tidak valid." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_attempt", {
    p_test_id: testId,
  });

  const attempt = data?.[0];
  if (error || !attempt) {
    return {
      ok: false,
      error: databaseErrorMessage(error, "Gagal memulai tes. Coba lagi."),
    };
  }

  return {
    ok: true,
    data: {
      attemptId: attempt.attempt_id,
      expiresAt: attempt.attempt_expires_at,
      serverNow: attempt.server_now,
    },
  };
}

export async function saveAnswerAction(
  attemptId: string,
  questionId: string,
  optionId: string,
): Promise<StudentActionResult> {
  const denied = await guardStudent();
  if (denied) return denied;
  if (
    !uuid.safeParse(attemptId).success ||
    !uuid.safeParse(questionId).success ||
    !uuid.safeParse(optionId).success
  ) {
    return { ok: false, error: "Data jawaban tidak valid." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_answer", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_option_id: optionId,
  });

  if (error) {
    return {
      ok: false,
      error: databaseErrorMessage(error, "Jawaban belum tersimpan."),
    };
  }

  return { ok: true, data: undefined };
}

export async function submitAttemptAction(
  attemptId: string,
): Promise<StudentActionResult<{ status: string }>> {
  const denied = await guardStudent();
  if (denied) return denied;
  if (!uuid.safeParse(attemptId).success) {
    return { ok: false, error: "Pengerjaan tidak valid." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_attempt", {
    p_attempt_id: attemptId,
  });

  if (error || !data?.[0]) {
    return {
      ok: false,
      error: databaseErrorMessage(error, "Gagal mengumpulkan jawaban."),
    };
  }

  return { ok: true, data: { status: data[0].status } };
}
