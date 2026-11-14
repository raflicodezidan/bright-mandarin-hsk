"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { deleteTestAction } from "@/app/admin/tests/actions";

export function DeleteTestButton({
  testId,
  title,
  hasAttempts,
}: {
  testId: string;
  title: string;
  hasAttempts: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteTestAction(testId);
      if (!result.ok) {
        toast(result.error, "error");
        setOpen(false);
        return;
      }
      toast(`Tes "${title}" dihapus.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        loading={pending}
        disabled={hasAttempts}
        title={
          hasAttempts
            ? "Tes tidak dapat dihapus karena sudah ada pengerjaan"
            : "Hapus tes"
        }
        onClick={() => setOpen(true)}
        icon={<Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />}
        className="text-accent hover:bg-accent-subtle"
      >
        Hapus
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Hapus tes "${title}"?`}
        description="Tes, soal, opsi, kunci, dan medianya akan dihapus permanen."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button variant="danger" onClick={remove} loading={pending}>
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-muted">
          Tes yang sudah memiliki pengerjaan tidak dapat dihapus.
        </p>
      </Dialog>
    </>
  );
}