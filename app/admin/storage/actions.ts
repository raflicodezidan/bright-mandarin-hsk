"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { deleteStorageFile } from "@/lib/storage";
import { requireAdmin } from "@/lib/auth";

const pathSchema = z.string().min(1).max(512);

export async function deleteStorageFileAction(
  path: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();

  const parsed = pathSchema.safeParse(path);
  if (!parsed.success) {
    return { ok: false, error: "Path file tidak valid." };
  }

  const result = await deleteStorageFile(parsed.data);
  if (result.ok) {
    revalidatePath("/admin/storage");
    revalidatePath("/admin");
  }
  return result;
}
