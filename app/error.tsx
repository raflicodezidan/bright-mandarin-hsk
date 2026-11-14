"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-md border border-border bg-surface p-6">
        <h1 className="text-xl font-semibold text-text">
          Terjadi kesalahan
        </h1>
        <Alert tone="error">
          Halaman gagal dimuat. Periksa koneksi, lalu coba lagi.
        </Alert>
        <div className="pt-2">
          <Button onClick={reset}>Coba lagi</Button>
        </div>
      </div>
    </main>
  );
}
