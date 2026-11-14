"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth";
import { generatePassword } from "@/lib/password";
import {
  createStudentSchema,
  studentIdSchema,
  toggleStudentSchema,
  updateStudentSchema,
} from "@/lib/validation/students";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function guardAdmin(): Promise<{ ok: false; error: string } | null> {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "admin" || !session.profile.is_active) {
    return { ok: false, error: "Akses ditolak." };
  }
  return null;
}

function emailFor(username: string): string {
  const domain =
    process.env.STUDENT_EMAIL_DOMAIN ?? "students.brightmandarin.local";
  return `${username}@${domain}`;
}

export async function createStudentAction(input: {
  fullName: string;
  username: string;
  password: string;
}): Promise<ActionResult<{ username: string; password: string }>> {
  const denied = await guardAdmin();
  if (denied) return denied;

  const parsed = createStudentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const admin = createAdminClient();
  const email = emailFor(parsed.data.username);

  const existing = await admin
    .from("profiles")
    .select("id")
    .eq("username", parsed.data.username)
    .maybeSingle();

  if (existing.data) {
    return { ok: false, error: "Username sudah dipakai." };
  }

  const created = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { username: parsed.data.username },
  });

  if (created.error || !created.data.user) {
    if (/already|registered|exists/i.test(created.error?.message ?? "")) {
      return { ok: false, error: "Username sudah dipakai." };
    }
    return { ok: false, error: "Gagal membuat akun. Coba lagi." };
  }

  const profile = await admin.from("profiles").insert({
    id: created.data.user.id,
    username: parsed.data.username,
    full_name: parsed.data.fullName,
    role: "student",
    is_active: true,
  });

  if (profile.error) {
    await admin.auth.admin.deleteUser(created.data.user.id);
    return { ok: false, error: "Gagal menyimpan profil murid. Coba lagi." };
  }

  revalidatePath("/admin/students");
  return {
    ok: true,
    data: {
      username: parsed.data.username,
      password: parsed.data.password,
    },
  };
}

export async function updateStudentNameAction(input: {
  studentId: string;
  fullName: string;
}): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  const parsed = updateStudentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ full_name: parsed.data.fullName })
    .eq("id", parsed.data.studentId)
    .eq("role", "student");

  if (error) return { ok: false, error: "Gagal menyimpan perubahan." };

  revalidatePath("/admin/students");
  return { ok: true, data: undefined };
}

export async function resetStudentPasswordAction(input: {
  studentId: string;
}): Promise<ActionResult<{ password: string }>> {
  const denied = await guardAdmin();
  if (denied) return denied;

  const parsed = studentIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const admin = createAdminClient();
  const target = await admin
    .from("profiles")
    .select("id")
    .eq("id", parsed.data.studentId)
    .eq("role", "student")
    .maybeSingle();

  if (!target.data) return { ok: false, error: "Murid tidak ditemukan." };

  const password = generatePassword(10);
  const updated = await admin.auth.admin.updateUserById(parsed.data.studentId, {
    password,
  });

  if (updated.error) return { ok: false, error: "Gagal mereset password." };

  return { ok: true, data: { password } };
}

export async function toggleStudentActiveAction(input: {
  studentId: string;
  isActive: boolean;
}): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  const parsed = toggleStudentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.studentId)
    .eq("role", "student");

  if (error) return { ok: false, error: "Gagal mengubah status murid." };

  revalidatePath("/admin/students");
  return { ok: true, data: undefined };
}

export async function deleteStudentAction(input: {
  studentId: string;
}): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  const parsed = studentIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const admin = createAdminClient();

  const attempts = await admin
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("student_id", parsed.data.studentId);

  if ((attempts.count ?? 0) > 0) {
    return {
      ok: false,
      error:
        "Murid punya riwayat hasil dan tidak dapat dihapus. Nonaktifkan akunnya sebagai gantinya.",
    };
  }

  const deleted = await admin.auth.admin.deleteUser(parsed.data.studentId);
  if (deleted.error) {
    return { ok: false, error: "Gagal menghapus murid." };
  }

  revalidatePath("/admin/students");
  return { ok: true, data: undefined };
}
