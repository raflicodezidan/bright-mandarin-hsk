import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-md border border-border bg-surface p-6">
        <p className="font-mono text-xs text-text-muted tabular">404</p>
        <h1 className="text-xl font-semibold text-text">
          Halaman tidak ditemukan
        </h1>
        <p className="text-sm text-text-muted">
          Alamat yang Anda buka tidak tersedia atau sudah dipindahkan.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-sm bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Kembali ke halaman masuk
          </Link>
        </div>
      </div>
    </main>
  );
}
