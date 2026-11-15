import { redirect } from "next/navigation";
import { LinkButton } from "@/components/ui/link-button";
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
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
          Tes selesai
        </p>
        <h1 className="text-[24px] font-bold leading-8 tracking-[-0.02em] text-[#18181B]">
          Terima kasih
        </h1>
      </header>

      <div className="flex flex-col gap-2 border-y border-[#DCD9D0] py-6">
        <p className="text-[14px] font-medium text-[#18181B]">
          Jawaban Anda telah tersimpan.
        </p>
        <p className="text-[13px] leading-6 text-[#52525B]">
          Nilai akan diperiksa oleh pengajar. Anda dapat menutup halaman ini.
        </p>
      </div>

      <div>
        <LinkButton href="/tests" variant="secondary">
          Kembali ke daftar tes
        </LinkButton>
      </div>
    </div>
  );
}
