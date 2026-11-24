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
import { TestRowActions } from "@/components/admin/tests/test-row-actions";
import { createClient } from "@/lib/supabase/server";
import { isOwnerRole, requireStaff } from "@/lib/auth";
import { formatDuration } from "@/lib/format";
import Link from "next/link";

export const metadata = { title: "Tes" };

export default async function AdminTestsPage() {
  const profile = await requireStaff();
  const isOwner = isOwnerRole(profile.role);
  const supabase = await createClient();

  const [testsResult, questionsResult, attemptsResult] = await Promise.all([
    supabase
      .from("tests")
      .select("id, title, level, duration_minutes, status, created_by, updated_at")
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

  let creatorNames = new Map<string, string>([
    [profile.id, profile.full_name],
  ]);
  if (isOwner) {
    const creatorsResult = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("role", ["owner", "admin", "teacher"]);
    creatorNames = new Map(
      (creatorsResult.data ?? []).map((creator) => [
        creator.id,
        creator.full_name,
      ]),
    );
  }

  const tests = testsResult.data ?? [];

  return (
    <>
      <PageHeader
        title="Tes"
        description={
          isOwner
            ? "Buat, tugaskan, dan kelola seluruh tes HSK."
            : "Tes milik Anda dan tes yang ditugaskan kepada Anda."
        }
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
          description={
            isOwner
              ? "Buat tes pertama untuk mulai menambahkan soal."
              : "Buat tes sendiri atau tunggu owner menugaskan tes kepada Anda."
          }
          action={<LinkButton href="/admin/tests/new">Buat tes</LinkButton>}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">No</TableHead>
              <TableHead className="w-[26%] min-w-[160px] text-left">
                Judul
              </TableHead>
              {isOwner ? (
                <TableHead className="w-[14%] text-left">Pemilik</TableHead>
              ) : null}
              <TableHead numeric className="w-[8%]">
                Level
              </TableHead>
              <TableHead numeric className="w-[10%]">
                Durasi
              </TableHead>
              <TableHead numeric className="w-[7%]">
                Soal
              </TableHead>
              <TableHead numeric className="w-[10%]">
                Pengerjaan
              </TableHead>
              <TableHead className="w-[12%]">Status</TableHead>
              <TableHead className="w-16">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tests.map((test, index) => (
              <TableRow key={test.id}>
                <TableCell className="font-mono text-xs tabular">
                  {index + 1}
                </TableCell>
                <TableCell className="text-left font-medium">
                  <Link
                    href={`/admin/tests/${test.id}`}
                    className="hover:text-primary hover:underline"
                  >
                    {test.title}
                  </Link>
                </TableCell>
                {isOwner ? (
                  <TableCell className="text-left text-text-muted">
                    {test.created_by
                      ? creatorNames.get(test.created_by) ?? "-"
                      : "-"}
                  </TableCell>
                ) : null}
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
                  <TestRowActions
                    test={{
                      id: test.id,
                      title: test.title,
                      hasAttempts: (attemptCounts.get(test.id) ?? 0) > 0,
                    }}
                    canManage={isOwner || test.created_by === profile.id}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
