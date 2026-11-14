import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type Profile = Tables<"profiles">;

export const getSessionProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;

  return { user, profile };
});

export async function requireAdmin(): Promise<Profile> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (session.profile.role !== "admin") redirect("/tests");
  return session.profile;
}

export async function requireStudent(): Promise<Profile> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (session.profile.role !== "student") redirect("/admin");
  return session.profile;
}
