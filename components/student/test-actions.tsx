"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
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
      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
        {label}
      </dt>
      <dd className="font-mono text-sm font-medium tabular text-[#18181B]">
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
      <Button variant="secondary" size="sm" className="w-full sm:w-auto" disabled>
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
        className="w-full sm:w-auto"
        onClick={() => setOpen(true)}
      >
        {mode === "resume" ? "Lanjutkan" : "Mulai Tes"}
      </Button>

      <Dialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title={mode === "resume" ? "Lanjutkan tes" : "Konfirmasi tes"}
        description={title}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button
              variant={mode === "resume" ? "neutral" : "primary"}
              className="w-full sm:w-auto"
              onClick={confirm}
              loading={pending}
            >
              {mode === "resume" ? "Lanjutkan" : "Mulai Sekarang"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-3 gap-3 rounded-[3px] border border-[#DCD9D0] bg-[#FAF9F6] px-4 py-4">
            <MetaItem label="Level" value={`HSK ${level}`} />
            <MetaItem label="Soal" value={String(questionCount)} />
            <MetaItem label="Durasi" value={`${durationMinutes} mnt`} />
          </dl>

          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
              Instruksi
            </p>
            <p className="text-[13px] leading-5 text-[#52525B]">
              {description?.trim() ||
                "Kerjakan seluruh soal Listening dan Reading secara berurutan. Jawaban tersimpan otomatis saat dipilih."}
            </p>
          </div>

          <div className="rounded-[3px] border border-[#E0D1B7] bg-[#F3ECE0] px-4 py-3 text-[12px] leading-5 text-[#52525B]">
            {mode === "resume"
              ? "Waktu terus berjalan sejak tes dimulai. Menutup tab atau kehilangan koneksi tidak menghentikan waktu."
              : "Tes hanya dapat dikerjakan satu kali dan waktu tidak dapat dihentikan. Menutup tab atau kehilangan koneksi tidak menghentikan waktu."}
          </div>

          {error ? <Alert tone="error">{error}</Alert> : null}
        </div>
      </Dialog>
    </>
  );
}
