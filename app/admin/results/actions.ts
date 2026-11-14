"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { databaseErrorMessage } from "@/lib/errors";

const attemptIdSchema = z.string().uuid();

export type ResetResult =
  | { ok: true }
  | { ok: false; error: string };

export async function resetAttemptAction(
  attemptId: string,
): Promise<ResetResult> {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "admin") {
    return { ok: false, error: "Akses ditolak." };
  }

  if (!attemptIdSchema.safeParse(attemptId).success) {
    return { ok: false, error: "Pengerjaan tidak valid." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reset_attempt", {
    p_attempt_id: attemptId,
  });

  if (error) {
    return {
      ok: false,
      error: databaseErrorMessage(error, "Gagal mereset pengerjaan."),
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/results");
  revalidatePath(`/admin/results/${attemptId}`);
  return { ok: true };
}
