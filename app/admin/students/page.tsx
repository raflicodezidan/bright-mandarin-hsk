import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateStudentDialog } from "@/components/admin/students/create-student-dialog";
import { StudentRowActions } from "@/components/admin/students/student-row-actions";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Murid" };

const PAGE_SIZE = 25;

type SearchParams = Promise<{
  q?: string;
  status?: string;
  page?: string;
}>;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const status =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : "all";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, username, full_name, is_active, created_at", { count: "exact" })
    .eq("role", "student");

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,username.ilike.%${q}%`);
  }
  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false);

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const students = data ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function hrefForPage(nextPage: number): string {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (status !== "all") search.set("status", status);
    search.set("page", String(nextPage));
    return `/admin/students?${search.toString()}`;
  }

  return (
    <>
      <PageHeader
        title="Murid"
        description="Kelola akun murid kursus."
        actions={<CreateStudentDialog />}
      />

      <div className="flex flex-col gap-4">
        <form
          method="get"
          className="flex flex-col gap-3 border-b border-[#DCD9D0] pb-4 sm:flex-row sm:items-center"
        >
          <div className="w-full sm:max-w-xs">
            <label htmlFor="q" className="sr-only">
              Cari murid
            </label>
            <Input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Cari nama atau username"
            />
          </div>
          <div className="w-full sm:w-44">
            <label htmlFor="status" className="sr-only">
              Status
            </label>
            <Select id="status" name="status" defaultValue={status}>
              <option value="all">Semua status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="neutral">
              Terapkan
            </Button>
            {q || status !== "all" ? (
              <Link
                href="/admin/students"
                className="text-xs text-text-muted underline-offset-2 hover:underline"
              >
                Hapus filter
              </Link>
            ) : null}
          </div>
        </form>

        {error ? (
          <EmptyState
            title="Gagal memuat data"
            description="Periksa koneksi, lalu muat ulang halaman."
          />
        ) : students.length === 0 ? (
          <EmptyState
            title={q || status !== "all" ? "Tidak ada murid yang cocok" : "Belum ada murid"}
            description={
              q || status !== "all"
                ? "Ubah kata kunci atau filter status."
                : "Tambahkan murid pertama untuk mulai."
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] uppercase tracking-[0.08em]">Nama</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.08em]">Username</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.08em]">Status</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.08em]">Dibuat</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.full_name}</TableCell>
                    <TableCell className="font-mono text-xs tabular">
                      {student.username}
                    </TableCell>
                    <TableCell>
                      {student.is_active ? (
                        <Badge tone="success">Aktif</Badge>
                      ) : (
                        <Badge tone="muted">Nonaktif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular text-text-muted">
                      {formatDate(student.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <StudentRowActions
                        student={{
                          id: student.id,
                          fullName: student.full_name,
                          username: student.username,
                          isActive: student.is_active,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={PAGE_SIZE}
              hrefForPage={hrefForPage}
            />
          </>
        )}
      </div>
    </>
  );
}
