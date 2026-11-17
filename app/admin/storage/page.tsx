import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StorageCard } from "@/components/admin/storage-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteStorageFileButton } from "@/components/admin/storage/delete-storage-file-button";
import { requireAdmin } from "@/lib/auth";
import { formatBytes, formatDateTime } from "@/lib/format";
import { getStorageUsage } from "@/lib/storage-usage";
import { listStorageFiles } from "@/lib/storage";

export const metadata = { title: "Penyimpanan" };

export default async function StoragePage() {
  await requireAdmin();

  const [usage, files] = await Promise.all([
    getStorageUsage(),
    listStorageFiles(),
  ]);

  const fileList = files.ok ? files.data : [];

  return (
    <>
      <PageHeader
        title="Penyimpanan"
        description="Kelola file media yang disimpan di Supabase Storage."
        actions={
          <Link
            href="/admin"
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            Kembali ke dashboard
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        {usage.ok ? (
          <StorageCard usage={usage.data} />
        ) : (
          <Card>
            <p className="text-sm text-text-muted">{usage.error}</p>
          </Card>
        )}

        {files.ok === false ? (
          <EmptyState
            title="Gagal memuat daftar file"
            description={files.error}
          />
        ) : fileList.length === 0 ? (
          <EmptyState
            title="Belum ada file"
            description="File audio dan gambar soal akan muncul di sini setelah diunggah."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">No</TableHead>
                <TableHead className="w-[46%] min-w-[220px]">Nama file</TableHead>
                <TableHead className="w-[14%]">Ukuran</TableHead>
                <TableHead className="w-[16%]">Status</TableHead>
                <TableHead className="w-[16%]">Diubah</TableHead>
                <TableHead className="w-24">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fileList.map((file, index) => (
                <TableRow key={file.path}>
                  <TableCell className="font-mono text-xs tabular">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-mono text-xs break-all">
                    {file.path}
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular">
                    {formatBytes(file.size)}
                  </TableCell>
                  <TableCell>
                    {file.referenced ? (
                      <Badge tone="success">Dipakai soal</Badge>
                    ) : (
                      <Badge tone="muted">Tidak dipakai</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular text-text-muted">
                    {file.updatedAt ? formatDateTime(file.updatedAt) : "-"}
                  </TableCell>
                  <TableCell>
                    <DeleteStorageFileButton path={file.path} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
