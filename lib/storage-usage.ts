import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET, STORAGE_USAGE_TAG } from "@/lib/storage";

const DEFAULT_QUOTA_BYTES = 1024 * 1024 * 1024; // 1 GB (Supabase Free)
const PAGE_SIZE = 1000;
const MAX_DEPTH = 5;
const CACHE_SECONDS = 300;

export type StorageUsage = {
  usedBytes: number;
  quotaBytes: number;
  remainingBytes: number;
  percentUsed: number;
};

function quotaBytesFromEnv(): number {
  const raw = process.env.STORAGE_QUOTA_BYTES;
  if (!raw) return DEFAULT_QUOTA_BYTES;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_QUOTA_BYTES;

  return Math.floor(parsed);
}

async function sumFolder(
  admin: ReturnType<typeof createAdminClient>,
  prefix: string,
  depth: number,
): Promise<number> {
  if (depth > MAX_DEPTH) return 0;

  let total = 0;
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
        total += await sumFolder(admin, childPrefix, depth + 1);
      } else {
        total += entry.metadata?.size ?? 0;
      }
    }

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return total;
}

const cachedStorageUsage = unstable_cache(
  async (): Promise<StorageUsage> => {
    const admin = createAdminClient();
    const usedBytes = await sumFolder(admin, "", 0);
    const quotaBytes = quotaBytesFromEnv();

    return {
      usedBytes,
      quotaBytes,
      remainingBytes: Math.max(0, quotaBytes - usedBytes),
      percentUsed: quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0,
    };
  },
  ["storage-usage", STORAGE_BUCKET],
  { revalidate: CACHE_SECONDS, tags: [STORAGE_USAGE_TAG] },
);

export async function getStorageUsage(): Promise<
  { ok: true; data: StorageUsage } | { ok: false; error: string }
> {
  try {
    return { ok: true, data: await cachedStorageUsage() };
  } catch (error) {
    console.error("[storage-usage] gagal menghitung penyimpanan", error);
    return {
      ok: false,
      error: "Gagal memuat penggunaan penyimpanan. Coba muat ulang halaman.",
    };
  }
}
