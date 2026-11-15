import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const MAX_MATCHED_STUDENTS = 500;

export type StudentSearch = {
  ids: string[];
  failed: boolean;
};

/**
 * Mencari murid berdasarkan nama lengkap atau username. Hasilnya dipakai untuk
 * memfilter pengerjaan lewat `student_id`.
 */
export async function searchStudentIds(
  supabase: SupabaseClient<Database>,
  term: string,
): Promise<StudentSearch> {
  const pattern = `%${term}%`;
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "student")
    .or(`full_name.ilike.${pattern},username.ilike.${pattern}`)
    .limit(MAX_MATCHED_STUDENTS);

  if (error) {
    return { ids: [], failed: true };
  }

  return { ids: (data ?? []).map((row) => row.id), failed: false };
}
