"use client";

import * as React from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

const pdfCache = new Map<string, Promise<PDFDocumentProxy>>();

function getPdfDocument(src: string): Promise<PDFDocumentProxy> {
  let existing = pdfCache.get(src);
  if (!existing) {
    existing = (async () => {
      const dynamicImport = new Function("url", "return import(url)");
      const pdfjs = (await dynamicImport("/pdf.min.mjs")) as typeof import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const loadingTask = pdfjs.getDocument({ url: src });
      return loadingTask.promise;
    })();
    pdfCache.set(src, existing);
  }
  return existing;
}

type State = {
  src: string | null;
  pdf: PDFDocumentProxy | null;
  error: string | null;
  loading: boolean;
};

export function usePdfDocument(src: string | null) {
  const [state, setState] = React.useState<State>({
    src,
    pdf: null,
    error: null,
    loading: Boolean(src),
  });

  React.useEffect(() => {
    if (!src) return;

    let active = true;

    getPdfDocument(src)
      .then((doc) => {
        if (!active) return;
        setState({ src, pdf: doc, error: null, loading: false });
      })
      .catch((err) => {
        if (!active) return;
        console.error("[usePdfDocument] Gagal memuat PDF", err);
        setState({
          src,
          pdf: null,
          error: "Dokumen PDF tidak dapat dimuat. Pastikan file valid dan masih tersedia.",
          loading: false,
        });
      });

    return () => {
      active = false;
    };
  }, [src]);

  const current = src && state.src === src ? state : { src, pdf: null, error: null, loading: Boolean(src) };

  return {
    pdf: current.pdf,
    error: current.error,
    loading: current.loading,
    numPages: current.pdf?.numPages ?? 0,
  };
}
