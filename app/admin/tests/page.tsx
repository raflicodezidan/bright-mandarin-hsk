import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState } from "@/components/ui/empty-state";
import { TestStatusBadge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DuplicateTestButton } from "@/components/admin/tests/duplicate-test-button";
import { createClient } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/format";
import Link from "next/link";

export const metadata = { title: "Tes" };

export default async function AdminTestsPage() {
  const supabase = await createClient();

  const [testsResult, questionsResult, attemptsResult] = await Promise.all([
    supabase
      .from("tests")
      .select("id, title, level, duration_minutes, status, updated_at")
      .order("updated_at", { ascending: false }),
    supabase.from("questions").select("test_id"),
    supabase.from("attempts").select("test_id"),
  ]);

  const questionCounts = new Map<string, number>();
  for (const row of questionsResult.data ?? []) {
    questionCounts.set(row.test_id, (questionCounts.get(row.test_id) ?? 0) + 1);
  }

  const attemptCounts = new Map<string, number>();
  for (const row of attemptsResult.data ?? []) {
    attemptCounts.set(row.test_id, (attemptCounts.get(row.test_id) ?? 0) + 1);
  }

  const tests = testsResult.data ?? [];

  return (
    <>
      <PageHeader
        title="Tes"
        description="Buat dan kelola tes HSK."
        actions={<LinkButton href="/admin/tests/new">Buat tes</LinkButton>}
      />

      {testsResult.error ? (
        <EmptyState
          title="Gagal memuat tes"
          description="Periksa koneksi, lalu muat ulang halaman."
        />
      ) : tests.length === 0 ? (
        <EmptyState
          title="Belum ada tes"
          description="Buat tes pertama untuk mulai menambahkan soal."
          action={<LinkButton href="/admin/tests/new">Buat tes</LinkButton>}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Judul</TableHead>
              <TableHead numeric>Level</TableHead>
              <TableHead numeric>Durasi</TableHead>
              <TableHead numeric>Soal</TableHead>
              <TableHead numeric>Pengerjaan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-56">
                <span className="sr-only">Aksi</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tests.map((test) => (
              <TableRow key={test.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/admin/tests/${test.id}`}
                    className="hover:text-primary hover:underline"
                  >
                    {test.title}
                  </Link>
                </TableCell>
                <TableCell numeric>HSK {test.level}</TableCell>
                <TableCell numeric>
                  {formatDuration(test.duration_minutes)}
                </TableCell>
                <TableCell numeric>{questionCounts.get(test.id) ?? 0}</TableCell>
                <TableCell numeric>{attemptCounts.get(test.id) ?? 0}</TableCell>
                <TableCell>
                  <TestStatusBadge status={test.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <DuplicateTestButton testId={test.id} title={test.title} />
                    <LinkButton
                      href={`/admin/tests/${test.id}`}
                      size="sm"
                      variant="secondary"
                    >
                      Kelola
                    </LinkButton>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
