"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { startTestAction } from "@/app/(student)/tests/actions";

export type TestActionMode = "start" | "resume" | "done";

export type TestActionsProps = {
  testId: string;
  title: string;
  level: number;
  durationMinutes: number;
  questionCount: number;
  description?: string | null;
  mode: TestActionMode;
};

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#71717A]">
        {label}
      </dt>
      <dd className="font-mono text-[13px] font-medium tabular text-[#18181B]">
        {value}
      </dd>
    </div>
  );
}

export function TestActions({
  testId,
  title,
  level,
  durationMinutes,
  questionCount,
  description,
  mode,
}: TestActionsProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  if (mode === "done") {
    return (
      <Button variant="secondary" size="sm" className="w-full border-[#DCD9D0] bg-[#F4F3EF] text-[#71717A] sm:w-auto" disabled>
        Selesai
      </Button>
    );
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      if (mode === "resume") {
        setOpen(false);
        router.push(`/tests/${testId}/take`);
        return;
      }

      const result = await startTestAction(testId);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const expired =
        new Date(result.data.expiresAt).getTime() <=
        new Date(result.data.serverNow).getTime();

      setOpen(false);
      router.push(expired ? `/tests/${testId}/done` : `/tests/${testId}/take`);
    });
  }

  return (
    <>
      <Button
        variant={mode === "resume" ? "neutral" : "primary"}
        size="sm"
        className="w-full px-4 py-2 text-[13px] font-medium sm:w-auto"
        onClick={() => setOpen(true)}
      >
        {mode === "resume" ? "Lanjutkan" : "Mulai Tes"}
      </Button>

      <Dialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title={
          <div className="flex flex-col items-start gap-1.5">
            <span className={`flex items-center gap-2 text-[12px] font-medium ${mode === "resume" ? "text-[#D97706]" : "text-[#1B5E3A]"}`}>
              <span className={`size-[6px] rounded-[1px] ${mode === "resume" ? "bg-[#D97706]" : "bg-[#1B5E3A]"}`} aria-hidden="true" />
              {mode === "resume" ? "Sedang dikerjakan" : "Terbuka"}
            </span>
            <span className="text-[18px] font-bold text-[#18181B]">{title}</span>
          </div>
        }
        size="lg"
        accentColor={mode === "resume" ? "#18181B" : "#1B5E3A"}
        examModal
        footer={
          <>
            {pending ? (
              <span className="mr-auto flex items-center gap-2 text-[12px] text-[#52525B]" role="status">
                <span className="size-3 animate-spin border-2 border-[#1B5E3A] border-t-transparent" aria-hidden="true" />
                Menyiapkan lembar tes...
              </span>
            ) : null}
            <Button
              variant="secondary"
              className="px-3.5 py-1.5 text-[12px] font-medium"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button
              variant={mode === "resume" ? "neutral" : "primary"}
              className="px-4 py-2 text-[13px] font-medium"
              onClick={confirm}
              loading={pending}
            >
              {mode === "resume" ? "Lanjutkan Sekarang" : "Mulai Sekarang"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-3 divide-x divide-[#DCD9D0] border border-[#DCD9D0] rounded-[2px] bg-[#F8F7F3]">
            <div className="px-4 py-3">
            <MetaItem label="Level" value={`HSK ${level}`} />
            </div>
            <div className="px-4 py-3">
            <MetaItem label="Soal" value={String(questionCount)} />
            </div>
            <div className="px-4 py-3">
            <MetaItem label="Durasi" value={`${durationMinutes} mnt`} />
            </div>
          </dl>

          <div className="exam-modal-block exam-modal-delay-3 flex flex-col gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">Ketentuan sesi</p>
            <p className="text-[13px] leading-5 text-[#52525B]">
              {description?.trim() || "Kerjakan seluruh soal Listening dan Reading secara berurutan. Jawaban tersimpan otomatis saat dipilih."}
            </p>
            <ul className="flex flex-col gap-2 text-[13px] leading-5 text-[#52525B]">
              <li className="flex gap-2.5"><span className="mt-[7px] size-1 shrink-0 bg-[#71717A]" />Penghitung waktu berjalan otomatis setelah sesi dimulai.</li>
              <li className="flex gap-2.5"><span className="mt-[7px] size-1 shrink-0 bg-[#71717A]" />Jawaban tersimpan otomatis di setiap perpindahan nomor soal.</li>
              <li className="flex gap-2.5"><span className="mt-[7px] size-1 shrink-0 bg-[#71717A]" />Nilai akhir hanya dapat dilihat pengajar setelah tes selesai.</li>
            </ul>
          </div>
          <p className="text-[12px] leading-5 text-[#52525B]">
            {mode === "resume" ? "Waktu terus berjalan sejak tes dimulai. Menutup tab atau kehilangan koneksi tidak menghentikan waktu." : "Tes hanya dapat dikerjakan satu kali dan waktu tidak dapat dihentikan. Menutup tab atau kehilangan koneksi tidak menghentikan waktu."}
          </p>
          {error ? <p className="text-[12px] text-[#A62626]" role="alert">{error}</p> : null}
        </div>
      </Dialog>
    </>
  );
}
