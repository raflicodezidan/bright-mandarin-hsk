"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, staffHome } from "@/lib/auth";

export type LoginState = { error?: string };

const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._]{3,30}$/, "Username tidak valid."),
  password: z.string().min(8, "Password minimal 8 karakter."),
});

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Username atau password salah." };
  }

  const domain =
    process.env.STUDENT_EMAIL_DOMAIN ?? "students.brightmandarin.local";
  const email = `${parsed.data.username}@${domain}`;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "Username atau password salah." };
  }

  const session = await getSessionProfile();

  if (!session || !session.profile.is_active) {
    await supabase.auth.signOut();
    return { error: "Akun tidak aktif. Hubungi guru atau owner." };
  }

  redirect(staffHome(session.profile.role));
}

const logoutSession = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
};

export async function logoutAction(): Promise<void> {
  await logoutSession();
  redirect("/login");
}
