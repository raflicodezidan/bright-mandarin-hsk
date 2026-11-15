"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { startTestAction } from "@/app/(student)/tests/actions";

export function StartTestButton({ testId }: { testId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function start() {
    setError(null);
    startTransition(async () => {
      const result = await startTestAction(testId);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const expired =
        new Date(result.data.expiresAt).getTime() <=
        new Date(result.data.serverNow).getTime();

      router.push(expired ? `/tests/${testId}/done` : `/tests/${testId}/take`);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button size="lg" onClick={start} loading={pending}>
        Mulai Tes
      </Button>
      <p className="text-xs text-text-muted">
        Waktu mulai berjalan segera setelah tombol ditekan.
      </p>
    </div>
  );
}
