"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { deleteStorageFileAction } from "@/app/admin/storage/actions";

export function DeleteStorageFileButton({ path }: { path: string }) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function handleDelete() {
    if (!window.confirm(`Hapus file "${path}"? Tindakan ini tidak bisa dibatalkan.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteStorageFileAction(path);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        type="button"
        variant="danger"
        size="sm"
        onClick={handleDelete}
        disabled={pending}
      >
        {pending ? "Menghapus..." : "Hapus"}
      </Button>
      {error ? <span className="text-xs text-[#A62626]">{error}</span> : null}
    </div>
  );
}
