"use client";

import * as React from "react";
import { Alert } from "@/components/ui/alert";
import { PdfPageCanvas } from "@/components/pdf/pdf-page-canvas";
import { usePdfDocument } from "@/components/pdf/use-pdf-document";

export type PdfOverlay = {
  id: string;
  kind: "choice" | "blank" | "match" | "drop";
  pageNumber: number;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PdfOverlaySelection = {
  selectedIds: string[];
  assignedLabels?: Record<string, string>;
  selectedText?: string;
};

function markerText(overlay: PdfOverlay, selection: PdfOverlaySelection): string {
  if (overlay.kind === "choice") return overlay.label ?? overlay.id;
  if (overlay.kind === "match") {
    return selection.assignedLabels?.[overlay.id] ?? overlay.label ?? overlay.id;
  }
  if (overlay.kind === "blank") {
    return selection.selectedText ?? overlay.label ?? "Isi";
  }
  return overlay.label ?? "Susun";
}

export function PdfQuestionDocument({
  src,
  overlays,
  selection,
  disabled = false,
  onSelect,
}: {
  src: string;
  overlays: PdfOverlay[];
  selection: PdfOverlaySelection;
  disabled?: boolean;
  onSelect: (overlay: PdfOverlay) => void;
}) {
  const { pdf, error, loading } = usePdfDocument(src);
  const pages = React.useMemo(() => {
    const unique = [...new Set(overlays.map((overlay) => overlay.pageNumber))];
    return unique.length > 0 ? unique.sort((a, b) => a - b) : [1];
  }, [overlays]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (loading) {
    return (
      <div className="flex min-h-72 items-center justify-center border border-border bg-surface-muted">
        <p className="text-sm text-text-muted">Memuat dokumen PDF…</p>
      </div>
    );
  }
  if (!pdf) return null;

  return (
    <div className="flex flex-col gap-4">
      {pages.map((pageNumber) => (
        <div key={pageNumber} className="flex flex-col gap-1">
          {pages.length > 1 ? (
            <p className="font-mono text-xs text-text-muted">Halaman {pageNumber}</p>
          ) : null}
          <PdfPageCanvas pdf={pdf} pageNumber={pageNumber}>
            {overlays
              .filter((overlay) => overlay.pageNumber === pageNumber)
              .map((overlay) => {
                const selected = selection.selectedIds.includes(overlay.id);
                const text = markerText(overlay, selection);
                return (
                  <button
                    key={overlay.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(overlay);
                    }}
                    disabled={disabled}
                    aria-label={`Pilih ${text}`}
                    aria-pressed={selected}
                    title={text}
                    style={{
                      left: `${overlay.x * 100}%`,
                      top: `${overlay.y * 100}%`,
                      width: `${overlay.width * 100}%`,
                      height: `${overlay.height * 100}%`,
                    }}
                    className={[
                      "absolute z-10 flex items-center justify-center border-2 px-1 font-mono text-xs font-bold shadow-none transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                      overlay.kind === "choice" ? "rounded-full" : "rounded-[2px]",
                      selected
                        ? "border-primary bg-primary text-white"
                        : "border-primary bg-white/85 text-primary hover:bg-primary-subtle",
                      disabled ? "cursor-default opacity-80" : "",
                    ].join(" ")}
                  >
                    <span className="max-w-full truncate">{text}</span>
                  </button>
                );
              })}
          </PdfPageCanvas>
        </div>
      ))}
    </div>
  );
}
