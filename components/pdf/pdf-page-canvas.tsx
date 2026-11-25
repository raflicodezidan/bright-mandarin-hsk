"use client";

import * as React from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { cn } from "@/lib/utils";

type PageSize = { width: number; height: number };

export function PdfPageCanvas({
  pdf,
  pageNumber,
  maxWidth = 920,
  className,
  children,
  onBackgroundClick,
  backgroundLabel,
}: {
  pdf: PDFDocumentProxy | null;
  pageNumber: number;
  maxWidth?: number;
  className?: string;
  children?: React.ReactNode;
  onBackgroundClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  backgroundLabel?: string;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const canvasHostRef = React.useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = React.useState(maxWidth);
  const [size, setSize] = React.useState<PageSize>({ width: 0, height: 0 });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const element = hostRef.current?.parentElement;
    if (!element) return;
    const update = () => {
      setAvailableWidth(Math.max(280, Math.min(maxWidth, element.clientWidth)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [maxWidth]);

  React.useEffect(() => {
    if (!pdf || !canvasHostRef.current) return;
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const scale = availableWidth / base.width;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas tidak tersedia.");
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.ceil(viewport.width * ratio);
        canvas.height = Math.ceil(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
          ...(ratio === 1 ? {} : { transform: [ratio, 0, 0, ratio, 0, 0] }),
        });
        await renderTask.promise;
        if (cancelled || !canvasHostRef.current) return;
        canvasHostRef.current.replaceChildren(canvas);
        setSize({ width: viewport.width, height: viewport.height });
      } catch (cause) {
        if (!cancelled && (cause as { name?: string } | null)?.name !== "RenderingCancelledException") {
          setError("Halaman PDF tidak dapat dirender.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, availableWidth]);

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={hostRef}
        role={onBackgroundClick ? "button" : undefined}
        tabIndex={onBackgroundClick ? 0 : undefined}
        aria-label={backgroundLabel}
        onClick={onBackgroundClick}
        onKeyDown={(event) => {
          if (!onBackgroundClick || (event.key !== "Enter" && event.key !== " ")) return;
          event.preventDefault();
          onBackgroundClick(event as unknown as React.MouseEvent<HTMLDivElement>);
        }}
        className={cn(
          "relative mx-auto min-h-72 overflow-hidden border border-border bg-white",
          onBackgroundClick && "cursor-crosshair",
        )}
        style={{ width: size.width || availableWidth, height: size.height || undefined }}
      >
        <div ref={canvasHostRef} className="absolute inset-0" />
        <div className="absolute inset-0">{children}</div>
        {loading ? (
          <p className="absolute inset-x-0 top-4 text-center text-sm text-text-muted">
            Memuat halaman PDF…
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="absolute inset-x-0 top-4 px-4 text-center text-sm text-accent">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
