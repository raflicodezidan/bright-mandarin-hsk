import { createMediaUploadUrlAction } from "@/app/admin/tests/actions";
import { createClient } from "@/lib/supabase/client";
import { STORAGE_BUCKET } from "@/lib/storage-constants";

export type MediaUploadKind = "listening_audio" | "teacher_pdf" | "student_pdf";

type UploadResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

const GENERIC_ERROR =
  "Gagal mengunggah file. Periksa koneksi lalu coba lagi.";

/**
 * Mengunggah file besar (audio/PDF) langsung dari browser ke Supabase Storage
 * memakai URL bertanda tangan. Ini menghindari batas 4,5 MB body Server Action
 * di Vercel yang membuat unggahan audio/PDF gagal dengan halaman error.
 */
export async function uploadFileDirect(
  file: File,
  testId: string,
  kind: MediaUploadKind,
): Promise<UploadResult> {
  let target: Awaited<ReturnType<typeof createMediaUploadUrlAction>>;
  try {
    target = await createMediaUploadUrlAction({
      testId,
      kind,
      contentType: file.type,
      size: file.size,
    });
  } catch (error) {
    console.error("[upload] gagal menyiapkan unggahan", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!target.ok) return target;

  try {
    const supabase = createClient();
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .uploadToSignedUrl(target.data.path, target.data.token, file, {
        contentType: file.type,
      });

    if (error) {
      console.error("[upload] gagal mengunggah file", error);
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch (error) {
    console.error("[upload] gagal mengunggah file", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true, path: target.data.path };
}
