"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { unassignStudentAction } from "@/app/admin/teachers/actions";

export function UnassignStudentButton({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function unassign() {
    setError(null);
    startTransition(async () => {
      const result = await unassignStudentAction({ studentId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast("Murid dilepas dari guru.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Lepas
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Lepas ${studentName}?`}
        description="Murid tidak lagi terhubung ke guru ini. Riwayat pengerjaan tetap tersimpan dan dapat dilihat owner."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button variant="danger" onClick={unassign} loading={pending}>
              Lepas
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {error ? <Alert tone="error">{error}</Alert> : null}
          <p className="text-sm text-text-muted">
            Murid dapat ditugaskan kembali ke guru ini atau guru lain kapan saja.
          </p>
        </div>
      </Dialog>
    </>
  );
}
