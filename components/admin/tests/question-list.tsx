"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import {
  deleteQuestionAction,
  moveQuestionAction,
} from "@/app/admin/tests/actions";

export type QuestionListItem = {
  id: string;
  number: number;
  prompt: string;
  hasAudio: boolean;
  hasImage: boolean;
  hasKey: boolean;
};

export function QuestionList({
  testId,
  items,
  locked,
  textOnly = false,
}: {
  testId: string;
  items: QuestionListItem[];
  locked: boolean;
  textOnly?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [deleting, setDeleting] = React.useState<QuestionListItem | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function move(questionId: string, direction: -1 | 1) {
    setError(null);
    startTransition(async () => {
      const result = await moveQuestionAction(questionId, direction);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    if (!deleting) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteQuestionAction(deleting.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast("Soal dihapus.");
      setDeleting(null);
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Belum ada soal"
        description="Tambahkan soal pertama pada bagian ini."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface">
        {items.map((item, index) => (
          <li
            key={item.id}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-surface-muted font-mono text-xs tabular">
                {item.number}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="line-clamp-2 font-cjk text-sm" lang="zh-Hans">
                  {item.prompt}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {item.hasAudio ? <Badge tone="primary">Audio</Badge> : null}
                  {item.hasImage ? <Badge tone="neutral">Gambar</Badge> : null}
                  {!item.hasKey ? (
                    <Badge tone="accent">Kunci belum diisi</Badge>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:pl-4">
              <button
                type="button"
                aria-label={`Naikkan soal ${item.number}`}
                disabled={pending || locked || textOnly || index === 0}
                onClick={() => move(item.id, -1)}
                className="rounded-sm p-2 text-text-muted hover:bg-surface-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40"
              >
                <ArrowUp size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Turunkan soal ${item.number}`}
                disabled={pending || locked || textOnly || index === items.length - 1}
                onClick={() => move(item.id, 1)}
                className="rounded-sm p-2 text-text-muted hover:bg-surface-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40"
              >
                <ArrowDown size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
                <Link
                  href={`/admin/tests/${testId}/questions/${item.id}`}
                aria-label={`Edit soal ${item.number}`}
                  aria-disabled={locked}
                  className={`rounded-sm p-2 text-text-muted hover:bg-surface-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${locked ? "pointer-events-none opacity-40" : ""}`}
              >
                <Pencil size={16} strokeWidth={1.5} aria-hidden="true" />
              </Link>
              <button
                type="button"
                title={
                  locked || textOnly
                    ? "Penghapusan tidak tersedia setelah ada pengerjaan"
                    : "Hapus soal"
                }
                aria-label={`Hapus soal ${item.number}`}
                  disabled={pending || locked || textOnly}
                onClick={() => {
                  setError(null);
                  setDeleting(item);
                }}
                className="rounded-sm p-2 text-accent hover:bg-accent-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40"
              >
                <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={deleting ? `Hapus soal ${deleting.number}?` : "Hapus soal?"}
        description="Soal beserta opsi, kunci, dan medianya akan dihapus permanen."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleting(null)}
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
          Nomor soal setelahnya akan dirapikan otomatis.
        </p>
      </Dialog>
    </div>
  );
}
