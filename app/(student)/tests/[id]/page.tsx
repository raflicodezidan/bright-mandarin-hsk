import { notFound, redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { createClient } from "@/lib/supabase/server";
import { requireStudent } from "@/lib/auth";
import { formatDuration } from "@/lib/format";
import { StartTestButton } from "./start-test-button";

export const metadata = { title: "Instruksi tes" };

export default async function TestInstructionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStudent();
  const { id } = await params;
  const supabase = await createClient();

  await supabase.rpc("finalize_expired_attempts");

  const [summaryResult, attemptResult] = await Promise.all([
    supabase.rpc("get_test_summary", { p_test_id: id }),
    supabase
      .from("student_attempt_status")
      .select("*")
      .eq("test_id", id)
      .maybeSingle(),
  ]);

  const summary = summaryResult.data?.[0];
  if (!summary) notFound();

  const attempt = attemptResult.data;

  if (attempt?.status === "in_progress") {
    redirect(`/tests/${id}/take`);
  }
  if (attempt) {
    redirect(`/tests/${id}/done`);
  }

  return (
    <>
      <h1 className="pb-6 text-xl font-semibold text-text">{summary.title}</h1>

      <div className="flex flex-col gap-6">
        <Card>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-text-muted">Level</dt>
              <dd className="font-mono text-base font-medium tabular">
                HSK {summary.level}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-text-muted">Durasi</dt>
              <dd className="font-mono text-base font-medium tabular">
                {formatDuration(summary.duration_minutes)}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-text-muted">Listening</dt>
              <dd className="font-mono text-base font-medium tabular">
                {summary.listening_count} soal
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-text-muted">Reading</dt>
              <dd className="font-mono text-base font-medium tabular">
                {summary.reading_count} soal
              </dd>
            </div>
          </dl>

          {summary.description ? (
            <p className="mt-6 border-t border-border pt-6 text-sm text-text">
              {summary.description}
            </p>
          ) : null}
        </Card>

        <Alert tone="warning" title="Perhatian">
          Tes hanya dapat dikerjakan satu kali dan waktu tidak dapat dihentikan.
          Menutup tab atau kehilangan koneksi tidak menghentikan waktu.
        </Alert>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <StartTestButton testId={id} />
          <LinkButton href="/tests" variant="secondary" size="lg">
            Kembali
          </LinkButton>
        </div>
      </div>
    </>
  );
}
