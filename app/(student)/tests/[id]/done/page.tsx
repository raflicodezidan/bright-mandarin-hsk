import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStudent } from "@/lib/auth";

export const metadata = { title: "Selesai" };

export default async function DonePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStudent();
  const { id } = await params;
  const supabase = await createClient();

  await supabase.rpc("finalize_expired_attempts");

  const attempt = await supabase
    .from("student_attempt_status")
    .select("id, status")
    .eq("test_id", id)
    .maybeSingle();

  if (!attempt.data) {
    redirect("/tests");
  }

  return (
    <div className="flex flex-col gap-4 py-8">
      <h1 className="text-xl font-semibold text-text">Terima kasih</h1>
      <p className="text-base text-text">
        Jawaban Anda telah tersimpan. Terima kasih.
      </p>
      <p className="text-sm text-text-muted">
        Nilai akan diperiksa oleh pengajar. Anda dapat menutup halaman ini.
      </p>
      <div>
        <Link
          href="/tests"
          className="text-sm text-primary underline underline-offset-2"
        >
          Kembali ke daftar tes
        </Link>
      </div>
    </div>
  );
}
