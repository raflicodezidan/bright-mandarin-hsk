import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type Profile = Tables<"profiles">;
export type ProfileRole = Profile["role"];

export function isOwnerRole(role: ProfileRole): boolean {
  return role === "owner" || role === "admin";
}

export function isStaffRole(role: ProfileRole): boolean {
  return isOwnerRole(role) || role === "teacher";
}

export function staffHome(role: ProfileRole): string {
  return isStaffRole(role) ? "/admin" : "/tests";
}

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

export async function requireOwner(): Promise<Profile> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (!isOwnerRole(session.profile.role)) redirect("/admin");
  return session.profile;
}

/**
 * Owner dan guru sama-sama memakai area /admin. Isolasi data dilakukan oleh
 * RLS; halaman yang hanya untuk owner memakai requireOwner().
 */
export async function requireStaff(): Promise<Profile> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (!isStaffRole(session.profile.role)) redirect("/tests");
  return session.profile;
}

/** Nama lama dipertahankan untuk halaman yang memang hanya untuk owner. */
export async function requireAdmin(): Promise<Profile> {
  return requireOwner();
}

export async function requireStudent(): Promise<Profile> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (session.profile.role !== "student") redirect("/admin");
  return session.profile;
}
