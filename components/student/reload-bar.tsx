"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ReloadBar({ checkedAt }: { checkedAt: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function reload() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[12px] text-[#71717A]">
        Nilai hanya dapat dilihat oleh pengajar.
      </p>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] tabular text-[#71717A]">
          Diperiksa {checkedAt}
        </span>
        <Button
          variant="secondary"
          size="sm"
          className="px-3 py-1.5 text-[12px] font-medium"
          onClick={reload}
          loading={pending}
        >
          Muat ulang
        </Button>
      </div>
    </div>
  );
}
