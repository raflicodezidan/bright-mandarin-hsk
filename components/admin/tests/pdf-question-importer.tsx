"use client";

import * as React from "react";
import { FileUp, Save } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveImportedQuestionAction, uploadTestPdfAction } from "@/app/admin/tests/actions";
import {
  parseReadingPdfLines,
  type ImportedQuestionDraft,
} from "@/lib/pdf-question-parser";

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PAGES = 100;
function updateDraft(
  drafts: ImportedQuestionDraft[],
  index: number,
  update: (draft: ImportedQuestionDraft) => ImportedQuestionDraft,
) {
  return drafts.map((draft, itemIndex) =>
    itemIndex === index ? update(draft) : draft,
  );
}

export function PdfQuestionImporter({
  testId,
  disabled = false,
}: {
  testId: string;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = React.useState<ImportedQuestionDraft[]>([]);
  const [fileName, setFileName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [savingIndex, setSavingIndex] = React.useState<number | null>(null);

  async function importPdf(file: File) {
    setError(null);
    setNotice(null);
    setDrafts([]);
    setFileName("");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Pilih file PDF.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError("Ukuran PDF maksimal 20 MB.");
      return;
    }

    setFileName(file.name);
    try {
      setNotice("Mengunggah PDF privat untuk editor overlay…");
      const uploaded = await uploadTestPdfAction(testId, file);
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

      if (pdf.numPages > MAX_PAGES) {
        setError(`PDF memiliki ${pdf.numPages} halaman. Batas impor ${MAX_PAGES} halaman.`);
        await loadingTask.destroy();
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
        if (rows.size === 0) imageCount += 1;
        lines.push(
          ...[...rows.entries()]
            .sort(([a], [b]) => b - a)
            .map(([, row]) => row.sort((a, b) => a.x - b.x).map((item) => item.text).join(" ")),
        );
      }
      await loadingTask.destroy();

      const parsed = parseReadingPdfLines(lines);
      if (parsed.length === 0) {
        setError(
          imageCount === pdf.numPages
            ? "PDF ini tampaknya berupa hasil scan/gambar. Ekstraksi OCR belum tersedia; silakan buat soal manual dari dokumen tersebut."
            : "Belum ditemukan soal pilihan ganda yang dapat diimpor. PDF tetap diproses hanya di browser.",
        );
        return;
      }

      setDrafts(parsed);
      setNotice(
        `PDF disimpan secara privat (${pdf.numPages} halaman). Gunakan editor di bawah untuk menaruh lingkaran opsi pada halaman asli.${parsed.length ? ` Ekstraksi teks juga mendeteksi ${parsed.length} kandidat pilihan ganda.` : " Ekstraksi teks tidak menemukan kandidat otomatis."}${imageCount > 0 ? ` ${imageCount} halaman tampak berupa gambar.` : ""}`,
      );
    } catch {
      setError("PDF gagal dibaca. Coba file lain atau masukkan soal melalui editor.");
    }
  }

  function saveOne(index: number) {
    const draft = drafts[index];
    if (!draft || !draft.correctLabel) {
      setError("Pilih kunci jawaban untuk draft yang akan disimpan.");
      return;
    }
    setError(null);
    setSavingIndex(index);
    startTransition(async () => {
      const result = await saveImportedQuestionAction({
        testId,
        prompt: draft.prompt,
        options: draft.options,
        correctLabel: draft.correctLabel,
      });
      setSavingIndex(null);
      if (!result.ok) {
        setError(`Soal PDF nomor ${draft.sourceNumber}: ${result.error}`);
        return;
      }
      setDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index));
      toast(`Soal nomor ${draft.sourceNumber} ditambahkan ke Reading.`);
    });
  }

  return (
    <Card title="PDF sumber soal" description="Simpan dokumen privat sebagai halaman soal asli, lalu posisikan lingkaran opsi di editor PDF overlay.">
      <div className="flex flex-col gap-4">
        <Alert tone="warning">PDF menjadi dokumen sumber privat. Jangan unggah versi yang menampilkan kunci jawaban kepada murid. Kunci untuk tiap soal overlay dipilih terpisah di editor dan tetap disembunyikan di sisi murid.</Alert>
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
              loading={pending && savingIndex === null}
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              Pilih PDF
            </Button>
            <span className="text-xs text-text-muted">
              {fileName || "Maksimal 20 MB."}
            </span>
          </div>
        )}

        {error ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert tone="info">{notice}</Alert> : null}

        {drafts.length > 0 ? (
          <div className="flex flex-col gap-4">
            {drafts.map((draft, index) => (
              <div key={`${draft.sourceNumber}-${index}`} className="flex flex-col gap-3 border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Draft dari nomor PDF {draft.sourceNumber}</h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    loading={pending && savingIndex === index}
                    disabled={pending || !draft.correctLabel}
                    icon={<Save size={14} strokeWidth={1.5} aria-hidden="true" />}
                    onClick={() => saveOne(index)}
                  >
                    Simpan soal
                  </Button>
                </div>
                <Field label="Teks soal" htmlFor={`pdf-prompt-${index}`} required>
                  <Textarea
                    id={`pdf-prompt-${index}`}
                    value={draft.prompt}
                    onChange={(event) => setDrafts((items) => updateDraft(items, index, (item) => ({ ...item, prompt: event.target.value })))}
                    maxLength={4000}
                    disabled={pending}
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  {draft.options.map((option, optionIndex) => (
                    <Field key={option.label} label={`Opsi ${option.label}`} htmlFor={`pdf-option-${index}-${optionIndex}`} required>
                      <div className="flex gap-2">
                        <Input
                          id={`pdf-option-${index}-${optionIndex}`}
                          value={option.text}
                          maxLength={2000}
                          onChange={(event) => setDrafts((items) => updateDraft(items, index, (item) => ({
                            ...item,
                            options: item.options.map((entry, i) => i === optionIndex ? { ...entry, text: event.target.value } : entry),
                          })))}
                          disabled={pending}
                        />
                        <label className="flex shrink-0 items-center gap-1 text-xs">
                          <input
                            type="radio"
                            name={`pdf-correct-${index}`}
                            checked={draft.correctLabel === option.label}
                            onChange={() => setDrafts((items) => updateDraft(items, index, (item) => ({ ...item, correctLabel: option.label })))}
                            disabled={pending}
                          />
                          Kunci
                        </label>
                      </div>
                    </Field>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
