import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { createClient } from "@/lib/supabase/server";
import { requireStudent } from "@/lib/auth";
import { formatDuration } from "@/lib/format";

export const metadata = { title: "Tes" };

export default async function StudentTestsPage() {
  await requireStudent();
  const supabase = await createClient();

  await supabase.rpc("finalize_expired_attempts");

  const [testsResult, attemptsResult] = await Promise.all([
    supabase
      .from("tests")
      .select("id, title, level, duration_minutes, status")
      .order("updated_at", { ascending: false }),
    supabase.from("student_attempt_status").select("*"),
  ]);

  const attemptsByTest = new Map(
    (attemptsResult.data ?? []).map((attempt) => [attempt.test_id, attempt]),
  );

  const visible = (testsResult.data ?? []).filter((test) => {
    if (test.status === "open") return true;
    const attempt = attemptsByTest.get(test.id);
    return attempt?.status === "in_progress";
  });

  return (
    <>
      <h1 className="pb-6 text-xl font-semibold text-text">Tes</h1>

      {visible.length === 0 ? (
        <EmptyState
          title="Belum ada tes"
          description="Tes yang dibuka admin akan muncul di halaman ini."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {visible.map((test) => {
            const attempt = attemptsByTest.get(test.id);
            return (
              <li
                key={test.id}
                className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-text">
                      {test.title}
                    </h2>
                    <Badge tone="primary">HSK {test.level}</Badge>
                  </div>
                  <p className="text-xs text-text-muted">
                    {formatDuration(test.duration_minutes)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {!attempt ? (
                    <>
                      <Badge tone="neutral">Belum dikerjakan</Badge>
                      <LinkButton href={`/tests/${test.id}`} size="sm">
                        Lihat instruksi
                      </LinkButton>
                    </>
                  ) : attempt.status === "in_progress" ? (
                    <>
                      <Badge tone="warning">Sedang berlangsung</Badge>
                      <LinkButton
                        href={`/tests/${test.id}/take`}
                        size="sm"
                      >
                        Lanjutkan
                      </LinkButton>
                    </>
                  ) : (
                    <Badge tone="success">Selesai</Badge>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="pt-6 text-xs text-text-muted">
        Nilai hanya dapat dilihat oleh pengajar.{" "}
        <Link href="/tests" className="underline underline-offset-2">
          Muat ulang
        </Link>
      </p>
    </>
  );
}
