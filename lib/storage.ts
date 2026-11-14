import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "question-media";

export const AUDIO_TYPES = ["audio/mpeg", "audio/mp3"] as const;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const AUDIO_MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export type MediaKind = "audio" | "images";

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
    if (file.size > AUDIO_MAX_BYTES) {
      return { ok: false, error: "Ukuran audio maksimal 10 MB." };
    }
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
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploaded.error) {
    return { ok: false, error: "Gagal mengunggah media. Coba lagi." };
  }

  return { ok: true, path };
}

export async function copyMedia(sourcePath: string): Promise<string | null> {
  const admin = createAdminClient();
  const segments = sourcePath.split("/");
  const filename = segments.pop() ?? "file";
  const folder = segments.join("/");
  const extension = filename.includes(".") ? filename.split(".").pop() : "bin";
  const target = `${folder || "misc"}/${randomUUID()}.${extension}`;

  const copied = await admin.storage.from(BUCKET).copy(sourcePath, target);
  if (copied.error) return null;
  return target;
}

export async function removeMedia(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const admin = createAdminClient();
  await admin.storage.from(BUCKET).remove(paths);
}

export async function signMedia(
  path: string | null,
  expiresIn = 600,
): Promise<string | null> {
  if (!path) return null;
  const admin = createAdminClient();
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
