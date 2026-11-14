"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { setTestStatusAction } from "@/app/admin/tests/actions";
import type { Tables } from "@/lib/supabase/database.types";

type Status = Tables<"tests">["status"];

export function TestStatusActions({
  testId,
  status,
  hasAttempts,
}: {
  testId: string;
  status: Status;
  hasAttempts: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function change(next: Status) {
    setError(null);
    startTransition(async () => {
      const result = await setTestStatusAction({ testId, status: next });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast("Status tes diperbarui.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="flex flex-wrap items-center gap-3">
        {status === "draft" ? (
          <Button onClick={() => change("open")} loading={pending}>
            Buka tes
          </Button>
        ) : null}
        {status === "open" ? (
          <Button onClick={() => change("closed")} loading={pending}>
            Tutup tes
          </Button>
        ) : null}
        {status === "closed" ? (
          <>
            <Button onClick={() => change("open")} loading={pending}>
              Buka lagi
            </Button>
            <Button
              variant="secondary"
              onClick={() => change("archived")}
              loading={pending}
            >
              Arsipkan
            </Button>
          </>
        ) : null}
        {status === "draft" ? (
          <Button
            variant="secondary"
            onClick={() => change("archived")}
            loading={pending}
          >
            Arsipkan
          </Button>
        ) : null}
        {status === "archived" ? (
          <Button
            variant="secondary"
            onClick={() => change("draft")}
            loading={pending}
            disabled={hasAttempts}
          >
            Kembalikan ke draft
          </Button>
        ) : null}
      </div>
      {status === "archived" && hasAttempts ? (
        <p className="text-xs text-text-muted">
          Tes yang sudah punya pengerjaan tidak dapat dikembalikan ke draft.
        </p>
      ) : null}
    </div>
  );
}
