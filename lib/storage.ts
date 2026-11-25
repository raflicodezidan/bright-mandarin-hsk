import "server-only";
import { randomUUID } from "node:crypto";
import { unstable_cache } from "next/cache";
import { revalidateTag, revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export const STORAGE_BUCKET = "question-media";
export const STORAGE_USAGE_TAG = "storage-usage";
export const STORAGE_FILES_TAG = "storage-files";

const PAGE_SIZE = 1000;
const MAX_DEPTH = 5;

export const AUDIO_TYPES = ["audio/mpeg", "audio/mp3"] as const;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const PDF_TYPES = ["application/pdf"] as const;
export const PDF_MAX_BYTES = 20 * 1024 * 1024;

export type MediaKind = "audio" | "images";

export async function uploadQuestionPdf(
  file: File,
  testId: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (!PDF_TYPES.includes(file.type as (typeof PDF_TYPES)[number]) || !file.name.toLowerCase().endsWith(".pdf")) {
    return { ok: false, error: "Dokumen soal harus berformat PDF." };
  }
  if (file.size < 1 || file.size > PDF_MAX_BYTES) {
    return { ok: false, error: "Ukuran PDF maksimal 20 MB." };
  }
  if (!/^[0-9a-f-]{36}$/i.test(testId)) {
    return { ok: false, error: "Tes tidak valid." };
  }

  const path = `pdfs/${testId}/${randomUUID()}.pdf`;
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: "application/pdf",
      upsert: false,
    });
  if (error) return { ok: false, error: "Gagal menyimpan PDF soal." };
  revalidateTag(STORAGE_USAGE_TAG, "max");
  revalidateTag(STORAGE_FILES_TAG, "max");
  return { ok: true, path };
}

function extensionFor(file: File, kind: MediaKind): string {
  // Ekstensi ditentukan dari MIME yang sudah divalidasi, bukan nama file,
  // agar file tidak bisa disimpan dengan ekstensi asing.
  if (kind === "audio") return "mp3";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export function validateMediaFile(
  file: File,
  kind: MediaKind,
): { ok: true } | { ok: false; error: string } {
  if (kind === "audio") {
    if (!AUDIO_TYPES.includes(file.type as (typeof AUDIO_TYPES)[number])) {
      return { ok: false, error: "Audio harus berformat mp3." };
    }
    if (file.size < 1) return { ok: false, error: "File audio kosong atau tidak valid." };
    return { ok: true };
  }

  if (!IMAGE_TYPES.includes(file.type as (typeof IMAGE_TYPES)[number])) {
    return { ok: false, error: "Gambar harus berformat jpg, png, atau webp." };
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return { ok: false, error: "Ukuran gambar maksimal 2 MB." };
  }
  return { ok: true };
}

export async function uploadMedia(
  file: File,
  kind: MediaKind,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const validation = validateMediaFile(file, kind);
  if (!validation.ok) return validation;

  const path = `${kind}/${randomUUID()}.${extensionFor(file, kind)}`;
  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const uploaded = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploaded.error) {
    return { ok: false, error: "Gagal mengunggah media. Coba lagi." };
  }

  revalidateTag(STORAGE_USAGE_TAG, "max");
  revalidateTag(STORAGE_FILES_TAG, "max");
  return { ok: true, path };
}

export async function copyMedia(sourcePath: string): Promise<string | null> {
  const admin = createAdminClient();
  const segments = sourcePath.split("/");
  const filename = segments.pop() ?? "file";
  const folder = segments.join("/");
  const extension = filename.includes(".") ? filename.split(".").pop() : "bin";
  const target = `${folder || "misc"}/${randomUUID()}.${extension}`;

  const copied = await admin.storage.from(STORAGE_BUCKET).copy(sourcePath, target);
  if (copied.error) return null;
  revalidateTag(STORAGE_USAGE_TAG, "max");
  revalidateTag(STORAGE_FILES_TAG, "max");
  return target;
}

export async function removeMedia(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const admin = createAdminClient();
  const removed = await admin.storage.from(STORAGE_BUCKET).remove(paths);
  if (!removed.error) {
    revalidateTag(STORAGE_USAGE_TAG, "max");
    revalidateTag(STORAGE_FILES_TAG, "max");
  }
}

export async function signMedia(
  path: string | null,
  expiresIn = 600,
): Promise<string | null> {
  if (!path) return null;
  const admin = createAdminClient();
  const { data } = await admin.storage.from(STORAGE_BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export type StorageFile = {
  path: string;
  size: number;
  updatedAt: string | null;
  referenced: boolean;
};

async function collectFiles(
  admin: ReturnType<typeof createAdminClient>,
  prefix: string,
  depth: number,
): Promise<{ path: string; size: number; updatedAt: string | null }[]> {
  if (depth > MAX_DEPTH) return [];

  const out: { path: string; size: number; updatedAt: string | null }[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await admin.storage
      .from(STORAGE_BUCKET)
      .list(prefix, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const entry of data) {
      if (entry.id === null) {
        const childPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
        out.push(...(await collectFiles(admin, childPrefix, depth + 1)));
      } else {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        out.push({
          path,
          size: entry.metadata?.size ?? 0,
          updatedAt: entry.updated_at ?? entry.created_at ?? null,
        });
      }
    }

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return out;
}

const cachedStorageFiles = unstable_cache(
  async (): Promise<StorageFile[]> => {
    const admin = createAdminClient();
    const files = await collectFiles(admin, "", 0);

    const [questionsResult, testsResult] = await Promise.all([
      admin.from("questions").select("image_path, audio_path"),
      admin.from("tests").select("pdf_path, student_pdf_path, listening_audio_path"),
    ]);
    if (questionsResult.error) throw questionsResult.error;
    if (testsResult.error) throw testsResult.error;

    const referenced = new Set<string>();
    for (const row of questionsResult.data ?? []) {
      if (row.image_path) referenced.add(row.image_path);
      if (row.audio_path) referenced.add(row.audio_path);
    }
    for (const row of testsResult.data ?? []) {
      if (row.pdf_path) referenced.add(row.pdf_path);
      if (row.student_pdf_path) referenced.add(row.student_pdf_path);
      if (row.listening_audio_path) referenced.add(row.listening_audio_path);
    }

    return files
      .map((file) => ({
        ...file,
        referenced: referenced.has(file.path),
      }))
      .sort((a, b) => b.size - a.size);
  },
  ["storage-files", STORAGE_BUCKET],
  { revalidate: 300, tags: [STORAGE_FILES_TAG, STORAGE_USAGE_TAG] },
);

export async function listStorageFiles(): Promise<
  { ok: true; data: StorageFile[] } | { ok: false; error: string }
> {
  try {
    return { ok: true, data: await cachedStorageFiles() };
  } catch (error) {
    console.error("[storage] gagal memuat daftar file", error);
    return {
      ok: false,
      error: "Gagal memuat daftar file penyimpanan. Coba muat ulang halaman.",
    };
  }
}

export async function deleteStorageFile(
  path: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!path || path.includes("..") || path.startsWith("/")) {
    return { ok: false, error: "Path file tidak valid." };
  }

  try {
    const admin = createAdminClient();

    const { data: refs, error: refError } = await admin
      .from("questions")
      .select("id")
      .or(`image_path.eq.${path},audio_path.eq.${path}`)
      .limit(1);
    if (refError) throw refError;

    const { data: testRefs, error: testRefError } = await admin
      .from("tests")
      .select("id")
      .or(`pdf_path.eq.${path},student_pdf_path.eq.${path},listening_audio_path.eq.${path}`)
      .limit(1);
    if (testRefError) throw testRefError;

    if ((refs && refs.length > 0) || (testRefs && testRefs.length > 0)) {
      return {
        ok: false,
        error:
          "File masih dipakai oleh soal atau tes. Ubah atau hapus referensinya terlebih dahulu.",
      };
    }

    const { error } = await admin.storage.from(STORAGE_BUCKET).remove([path]);
    if (error) throw error;

    revalidateTag(STORAGE_USAGE_TAG, "max");
    revalidateTag(STORAGE_FILES_TAG, "max");
    revalidatePath("/admin/storage");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    console.error("[storage] gagal menghapus file", error);
    return {
      ok: false,
      error: "Gagal menghapus file. Coba lagi.",
    };
  }
}
