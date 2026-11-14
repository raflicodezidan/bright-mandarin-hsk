"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { resetAttemptAction } from "@/app/admin/results/actions";

export function ResetAttemptButton({
  attemptId,
  studentName,
  testTitle,
  compact = false,
}: {
  attemptId: string;
  studentName: string;
  testTitle: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setError(null);
    startTransition(async () => {
      const result = await resetAttemptAction(attemptId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast("Pengerjaan direset. Murid dapat mengulang tes.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant={compact ? "ghost" : "secondary"}
        size="sm"
        onClick={() => setOpen(true)}
        icon={
          compact ? (
            <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" />
          ) : undefined
        }
      >
        Reset
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Reset pengerjaan ${studentName}?`}
        description={`Pengerjaan pada tes "${testTitle}" beserta semua jawabannya akan dihapus.`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button variant="danger" onClick={reset} loading={pending}>
              Reset
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {error ? <Alert tone="error">{error}</Alert> : null}
          <p className="text-sm text-text-muted">
            Setelah direset, murid dapat mengerjakan tes ini sekali lagi. Skor
            sebelumnya akan hilang.
          </p>
        </div>
      </Dialog>
    </>
  );
}
