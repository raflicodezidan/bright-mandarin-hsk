"use client";

import * as React from "react";
import { FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  saveImportedInteractiveQuestionAction,
  saveImportedQuestionAction,
  setTestPdfAction,
} from "@/app/admin/tests/actions";
import { uploadFileDirect } from "@/lib/upload-client";
import { createWorker } from "tesseract.js";
import {
  parseReadingPdfLines,
  type ImportedQuestionDraft,
} from "@/lib/pdf-question-parser";

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PAGES = 100;

export function PdfQuestionImporter({
  testId,
  disabled = false,
}: {
  testId: string;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function createQuestions(drafts: ImportedQuestionDraft[]) {
    const failures: string[] = [];
    let created = 0;

    for (let index = 0; index < drafts.length; index += 1) {
      const draft = drafts[index];
      setNotice(`Menyimpan soal ${index + 1} dari ${drafts.length} ke daftar Reading…`);
      const result =
        draft.kind === "multiple_choice"
          ? await saveImportedQuestionAction({
              testId,
              prompt: draft.prompt,
              options: draft.options.map((option) => ({
                label: option.label,
                text: option.text,
                imageDataUrl: option.imageDataUrl ?? null,
              })),
              correctLabel: "",
            })
          : draft.kind === "hanzi_blank"
            ? await saveImportedInteractiveQuestionAction({
                testId,
                type: "hanzi_blank",
                prompt: draft.prompt,
                config: { choices: draft.choices, blankCount: 1 },
                answerKey: draft.correctLabel
                  ? { correctLabel: draft.correctLabel }
                  : {},
              })
            : await saveImportedInteractiveQuestionAction({
                testId,
                type: "matching",
                prompt: draft.prompt,
                config: {
                  leftItems: draft.leftItems,
                  rightItems: draft.rightItems,
                },
                answerKey:
                  Object.keys(draft.matches).length > 0
                    ? { matches: draft.matches }
                    : {},
              });
      if (!result.ok) {
        failures.push(`Nomor ${draft.sourceNumber}: ${result.error}`);
        continue;
      }
      created += 1;
    }

    if (created > 0) {
      router.refresh();
      toast(`${created} soal dari PDF ditambahkan ke daftar Reading.`);
    }
    if (failures.length > 0) {
      setError(
        `${failures.length} soal gagal dibuat. ${failures.slice(0, 3).join(" ")}`,
      );
    }
    setNotice(
      created > 0
        ? `${created} soal berhasil dibuat. Lengkapi kunci jawaban lewat tombol Edit pada tiap soal agar tes dapat dibuka.`
        : null,
    );
  }

  async function importPdf(file: File) {
    setError(null);
    setNotice(null);
    setFileName("");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Pilih file PDF.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError("Ukuran PDF maksimal 20 MB.");
      return;
    }

    setPending(true);
    setFileName(file.name);
    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
    try {
      setNotice("Mengunggah PDF privat dan membaca soal…");
      const direct = await uploadFileDirect(file, testId, "teacher_pdf");
      if (!direct.ok) {
        setError(direct.error);
        setNotice(null);
        return;
      }
      const uploaded = await setTestPdfAction(testId, "teacher", direct.path);
      if (!uploaded.ok) {
        setError(uploaded.error);
        setNotice(null);
        return;
      }

      const dynamicImport = new Function("url", "return import(url)");
      const pdfjs = (await dynamicImport("/pdf.min.mjs")) as typeof import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const previewUrl = `/api/media?path=${encodeURIComponent(uploaded.data.path)}`;
      const loadingTask = pdfjs.getDocument({ url: previewUrl });
      const pdf = await loadingTask.promise;

      try {
        if (pdf.numPages > MAX_PAGES) {
          setError(`PDF memiliki ${pdf.numPages} halaman. Batas impor ${MAX_PAGES} halaman.`);
          return;
        }

        const lines: string[] = [];
        let imageCount = 0;
        for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
          const page = await pdf.getPage(pageNo);
          const content = await page.getTextContent();
          const rows = new Map<number, { x: number; text: string }[]>();
          for (const item of content.items) {
            if (!("str" in item) || !item.str.trim()) continue;
            const y = Math.round(item.transform[5] * 2) / 2;
            const row = rows.get(y) ?? [];
            row.push({ x: item.transform[4], text: item.str });
            rows.set(y, row);
          }
          if (rows.size === 0) {
            imageCount += 1;
            continue;
          }
          lines.push(
            ...[...rows.entries()]
              .sort(([a], [b]) => b - a)
              .map(([, row]) =>
                row.sort((a, b) => a.x - b.x).map((item) => item.text).join(" "),
              ),
          );
        }

        let parsed = parseReadingPdfLines(lines);
        if (parsed.length === 0 && imageCount > 0) {
          setNotice("OCR lokal Mandarin/Inggris sedang dijalankan. PDF tetap diproses di browser.");
          worker = await createWorker("chi_sim+eng", 1, {
            langPath: "https://tessdata.projectnaptha.com/4.0.0",
            logger: (message) => {
              if (message.status === "recognizing text") {
                setNotice(`OCR lokal sedang memindai: ${Math.round(message.progress * 100)}%`);
              }
            },
          });
          const ocrLines: string[] = [];
          for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
            const page = await pdf.getPage(pageNo);
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const context = canvas.getContext("2d");
            if (!context) continue;
            await page.render({ canvas, canvasContext: context, viewport }).promise;
            const recognized = await worker.recognize(canvas);
            ocrLines.push(...recognized.data.text.split(/\r?\n/u));
          }
          parsed = parseReadingPdfLines(ocrLines);
        }

        if (parsed.length === 0) {
          setError(
            imageCount > 0
              ? "OCR lokal tidak menemukan soal yang bisa diparsing. PDF tetap tersimpan; buat soal lewat editor PDF atau formulir manual."
              : "Belum ditemukan soal pilihan ganda yang dapat diimpor. PDF tetap tersimpan.",
          );
          return;
        }

        await createQuestions(parsed);
      } finally {
        if (worker) {
          await worker.terminate();
          worker = null;
        }
        await loadingTask.destroy();
      }
    } catch {
      setError("PDF gagal dibaca. Coba file lain atau masukkan soal melalui editor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card
      title="Impor soal dari PDF"
      description="Unggah PDF, lalu soal pilihan ganda langsung dibuat di daftar Reading. Kunci jawaban dilengkapi setelahnya lewat tombol Edit."
    >
      <div className="flex flex-col gap-4">
        <Alert tone="warning">
          PDF menjadi dokumen sumber privat. Kunci jawaban tidak dibaca dari PDF.
          Setelah soal dibuat, isi kunci tiap soal agar tes dapat dibuka untuk murid.
        </Alert>
        {disabled ? (
          <Alert tone="warning">Impor soal baru dinonaktifkan karena tes sudah memiliki pengerjaan.</Alert>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              disabled={pending}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void importPdf(file);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              icon={<FileUp size={15} strokeWidth={1.5} aria-hidden="true" />}
              loading={pending}
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              Pilih PDF dan buat soal
            </Button>
            <span className="text-xs text-text-muted">
              {fileName || "Maksimal 20 MB. Soal Reading dibuat otomatis."}
            </span>
          </div>
        )}

        {error ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert tone="info">{notice}</Alert> : null}
      </div>
    </Card>
  );
}
