"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile, isOwnerRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  assignStudentToTeacherSchema,
  createTeacherSchema,
  teacherIdSchema,
  toggleTeacherSchema,
  unassignStudentSchema,
} from "@/lib/validation/teachers";

export type TeacherActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function guardOwner(): Promise<{ ok: false; error: string } | null> {
  const session = await getSessionProfile();
  if (!session || !isOwnerRole(session.profile.role) || !session.profile.is_active) {
    return { ok: false, error: "Akses ditolak." };
  }
  return null;
}

function emailFor(username: string): string {
  const domain =
    process.env.STUDENT_EMAIL_DOMAIN ?? "students.brightmandarin.local";
  return `${username}@${domain}`;
}

function revalidateTeacherPages(teacherId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/teachers");
  revalidatePath("/admin/students");
  revalidatePath("/admin/tests");
  if (teacherId) revalidatePath(`/admin/teachers/${teacherId}`);
}

export async function createTeacherAction(input: {
  fullName: string;
  username: string;
  password: string;
}): Promise<TeacherActionResult<{ username: string; password: string }>> {
  const denied = await guardOwner();
  if (denied) return denied;

  const parsed = createTeacherSchema.safeParse(input);
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
    role: "teacher",
    is_active: true,
  });

  if (profile.error) {
    await admin.auth.admin.deleteUser(created.data.user.id);
    return { ok: false, error: "Gagal menyimpan profil guru. Coba lagi." };
  }

  revalidateTeacherPages();
  return {
    ok: true,
    data: {
      username: parsed.data.username,
      password: parsed.data.password,
    },
  };
}

export async function assignStudentAction(input: {
  teacherId: string;
  studentId: string;
}): Promise<TeacherActionResult> {
  const denied = await guardOwner();
  if (denied) return denied;

  const parsed = assignStudentToTeacherSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_student_to_teacher", {
    p_teacher_id: parsed.data.teacherId,
    p_student_id: parsed.data.studentId,
  });

  if (error) {
    return { ok: false, error: "Gagal mengatur guru murid. Coba lagi." };
  }

  revalidateTeacherPages(parsed.data.teacherId);
  return { ok: true, data: undefined };
}

export async function unassignStudentAction(input: {
  studentId: string;
}): Promise<TeacherActionResult> {
  const denied = await guardOwner();
  if (denied) return denied;

  const parsed = unassignStudentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("unassign_student", {
    p_student_id: parsed.data.studentId,
  });

  if (error) {
    return { ok: false, error: "Gagal melepas murid dari guru. Coba lagi." };
  }

  revalidateTeacherPages();
  return { ok: true, data: undefined };
}

export async function toggleTeacherActiveAction(input: {
  teacherId: string;
  isActive: boolean;
}): Promise<TeacherActionResult> {
  const denied = await guardOwner();
  if (denied) return denied;

  const parsed = toggleTeacherSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.teacherId)
    .eq("role", "teacher");

  if (error) return { ok: false, error: "Gagal mengubah status guru." };

  revalidateTeacherPages(parsed.data.teacherId);
  return { ok: true, data: undefined };
}

export async function resetTeacherPasswordAction(input: {
  teacherId: string;
  password: string;
}): Promise<TeacherActionResult> {
  const denied = await guardOwner();
  if (denied) return denied;

  const parsed = teacherIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data tidak valid." };

  const password = input.password;
  if (password.length < 8) {
    return { ok: false, error: "Password minimal 8 karakter." };
  }

  const admin = createAdminClient();
  const target = await admin
    .from("profiles")
    .select("id")
    .eq("id", parsed.data.teacherId)
    .eq("role", "teacher")
    .maybeSingle();

  if (!target.data) return { ok: false, error: "Guru tidak ditemukan." };

  const updated = await admin.auth.admin.updateUserById(parsed.data.teacherId, {
    password,
  });

  if (updated.error) return { ok: false, error: "Gagal mereset password." };

  return { ok: true, data: undefined };
}
