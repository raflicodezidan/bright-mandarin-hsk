import { notFound, redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/link-button";
import { createClient } from "@/lib/supabase/server";
import { requireStudent } from "@/lib/auth";
import { formatDuration } from "@/lib/format";
import { StartTestButton } from "./start-test-button";

export const metadata = { title: "Instruksi tes" };

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
        {label}
      </dt>
      <dd className="font-mono text-[15px] font-medium tabular text-[#18181B]">
        {value}
      </dd>
    </div>
  );
}

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
      <header className="flex flex-col gap-1 pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
          Instruksi tes
        </p>
        <h1 className="text-[24px] font-bold leading-8 tracking-[-0.02em] text-[#18181B]">
          {summary.title}
        </h1>
      </header>

      <dl className="grid grid-cols-2 gap-4 border-y border-[#DCD9D0] py-5 sm:grid-cols-4">
        <Detail label="Level" value={`HSK ${summary.level}`} />
        <Detail label="Durasi" value={formatDuration(summary.duration_minutes)} />
        <Detail label="Listening" value={`${summary.listening_count} soal`} />
        <Detail label="Reading" value={`${summary.reading_count} soal`} />
      </dl>

      {summary.description ? (
        <p className="border-b border-[#DCD9D0] py-5 text-[13px] leading-6 text-[#52525B]">
          {summary.description}
        </p>
      ) : null}

      <div className="pt-5">
        <Alert tone="warning" title="Perhatian">
          Tes hanya dapat dikerjakan satu kali dan waktu tidak dapat dihentikan.
          Menutup tab atau kehilangan koneksi tidak menghentikan waktu.
        </Alert>
      </div>

      <div className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-start">
        <StartTestButton testId={id} />
        <LinkButton href="/tests" variant="secondary" size="lg">
          Kembali
        </LinkButton>
      </div>
    </>
  );
}
