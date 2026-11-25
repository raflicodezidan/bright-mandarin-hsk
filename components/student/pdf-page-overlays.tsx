"use client";

import * as React from "react";

export type PdfOverlay = {
  pageNumber: number;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  optionId: string;
};

export function PdfPageOverlays({
  src,
  pageNumber,
  overlays,
  selectedLabel,
  disabled,
  onSelect,
}: {
  src: string;
  pageNumber: number;
  overlays: PdfOverlay[];
  selectedLabel: string | null;
  disabled: boolean;
  onSelect: (label: string) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let loadingTask: { promise: Promise<{ numPages: number; getPage: (page: number) => Promise<{ getViewport: (options: { scale: number }) => { width: number; height: number }; render: (params: { canvas: HTMLCanvasElement; canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number }; transform?: number[] | null }) => { promise: Promise<void> } }> }>; destroy: () => Promise<void> } | null = null;
    async function renderPdfPage() {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const task = pdfjs.getDocument({ url: src });
        loadingTask = task as unknown as NonNullable<typeof loadingTask>;
        const pdf = await task.promise;
        if (pageNumber > pdf.numPages) throw new Error("Halaman PDF tidak ditemukan.");
        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const maxWidth = Math.min(1000, containerRef.current?.clientWidth ?? 900);
        const scale = maxWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Browser tidak dapat menampilkan halaman PDF.");
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.ceil(viewport.width * ratio);
        canvas.height = Math.ceil(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        await page.render({ canvas, canvasContext: context, viewport, ...(ratio === 1 ? {} : { transform: [ratio, 0, 0, ratio, 0, 0] }) }).promise;
        if (cancelled || !containerRef.current) return;
        containerRef.current.replaceChildren(canvas);
        setDimensions({ width: viewport.width, height: viewport.height });
        setError(null);
        await task.destroy();
      } catch {
        if (!cancelled) setError("Halaman PDF tidak dapat dimuat.");
      }
    }
    void renderPdfPage();
    return () => { cancelled = true; if (loadingTask) void loadingTask.destroy(); };
  }, [src, pageNumber]);

  return (
    <div className="relative mx-auto max-w-full overflow-auto border border-border bg-white">
      {error ? <p role="alert" className="p-4 text-sm text-accent">{error}</p> : null}
      <div ref={containerRef} className="mx-auto w-fit" />
      {dimensions.width > 0 ? (
        <div className="pointer-events-none absolute left-1/2 top-0" style={{ width: dimensions.width, height: dimensions.height, transform: "translateX(-50%)" }}>
          {overlays.filter((overlay) => overlay.pageNumber === pageNumber).map((overlay) => (
            <button
              key={`${overlay.pageNumber}-${overlay.label}`}
              type="button"
              onClick={() => onSelect(overlay.label)}
              disabled={disabled}
              aria-label={`Pilih opsi ${overlay.label}`}
              aria-pressed={selectedLabel === overlay.label}
              style={{ left: `${overlay.x * 100}%`, top: `${overlay.y * 100}%`, width: `${overlay.width * 100}%`, height: `${overlay.height * 100}%` }}
              className={`pointer-events-auto absolute flex items-center justify-center rounded-full border-2 font-mono text-xs font-bold sm:text-sm ${selectedLabel === overlay.label ? "border-success bg-success/80 text-white" : "border-accent bg-white/70 text-accent"}`}
            >
              {overlay.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
