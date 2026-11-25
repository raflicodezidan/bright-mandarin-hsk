"use client";

import * as React from "react";
import { FileUp, Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { savePdfOverlayQuestionAction, uploadTestPdfAction } from "@/app/admin/tests/actions";

type OptionDraft = { label: string; text: string };
type Marker = { label: string; x: number; y: number; width: number; height: number };
const LETTERS = ["A", "B", "C", "D", "E"] as const;

export function PdfOverlayEditor({ testId, pdfUrl, disabled = false }: { testId: string; pdfUrl: string; disabled?: boolean }) {
  const { toast } = useToast();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const pageRef = React.useRef<HTMLDivElement>(null);
  const [url, setUrl] = React.useState(pdfUrl);
  const [pageCount, setPageCount] = React.useState(0);
  const [pageNumber, setPageNumber] = React.useState(1);
  const [pageWidth, setPageWidth] = React.useState(0);
  const [pageHeight, setPageHeight] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [prompt, setPrompt] = React.useState("");
  const [section, setSection] = React.useState<"listening" | "reading">("reading");
  const [options, setOptions] = React.useState<OptionDraft[]>([
    { label: "A", text: "" }, { label: "B", text: "" }, { label: "C", text: "" }, { label: "D", text: "" },
  ]);
  const [correctLabel, setCorrectLabel] = React.useState("A");
  const [markers, setMarkers] = React.useState<Marker[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    async function loadPage() {
      setLoading(true);
      setError(null);
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const loadingTask = pdfjs.getDocument({ url });
        task = loadingTask;
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setPageCount(pdf.numPages);
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const maxWidth = Math.min(900, pageRef.current?.parentElement?.clientWidth ?? 900);
        const scale = maxWidth / viewport.width;
        const scaled = page.getViewport({ scale });
        setPageWidth(scaled.width);
        setPageHeight(scaled.height);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Tidak dapat membuat pratinjau PDF.");
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.ceil(scaled.width * ratio);
        canvas.height = Math.ceil(scaled.height * ratio);
        canvas.style.width = `${scaled.width}px`;
        canvas.style.height = `${scaled.height}px`;
        await page.render({ canvas, canvasContext: context, viewport: scaled, ...(ratio === 1 ? {} : { transform: [ratio, 0, 0, ratio, 0, 0] }) }).promise;
        if (!cancelled && pageRef.current) {
          pageRef.current.replaceChildren(canvas);
        }
        await loadingTask.destroy();
      } catch {
        if (!cancelled) setError("PDF tidak dapat dirender. Pastikan file valid dan tidak rusak.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPage();
    return () => { cancelled = true; if (task) void task.destroy(); };
  }, [pageNumber, url]);

  function changeFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const result = await uploadTestPdfAction(testId, file);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const signed = `/api/media?path=${encodeURIComponent(result.data.path)}`;
      setUrl(signed);
      setPageNumber(1);
      setPageCount(0);
      setMarkers([]);
      toast("PDF berhasil diunggah.");
    });
  }

  function addMarker(event: React.MouseEvent<HTMLDivElement>) {
    if (disabled || !pageRef.current) return;
    const rect = pageRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const nextLabel = LETTERS.find((letter) => !markers.some((marker) => marker.label === letter));
    if (!nextLabel) {
      setError("Maksimal lima posisi opsi per soal.");
      return;
    }
    setMarkers((current) => [...current, { label: nextLabel, x, y, width: 0.045, height: 0.065 }]);
  }

  function saveQuestion() {
    setError(null);
    if (markers.length < 2 || markers.length !== options.length) {
      setError("Letakkan satu lingkaran untuk setiap opsi, minimal dua opsi.");
      return;
    }
    if (!prompt.trim()) {
      setError("Prompt soal wajib diisi.");
      return;
    }
    startTransition(async () => {
      const result = await savePdfOverlayQuestionAction({ testId, prompt, section, pageNumber, options, overlays: markers, correctLabel });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast("Soal PDF dengan lingkaran opsi disimpan.");
      setPrompt("");
      setMarkers([]);
      setOptions([{ label: "A", text: "" }, { label: "B", text: "" }, { label: "C", text: "" }, { label: "D", text: "" }]);
      setCorrectLabel("A");
    });
  }

  return (
    <Card title="Soal dengan opsi di atas PDF asli" description="PDF tampil apa adanya. Klik halaman untuk menaruh satu lingkaran per opsi; lingkaran akan menjadi area pilihan murid.">
      <div className="flex flex-col gap-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {disabled ? <Alert tone="warning">PDF overlay dinonaktifkan setelah tes memiliki pengerjaan.</Alert> : (
          <div className="flex flex-wrap items-center gap-3">
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="sr-only" disabled={pending} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; changeFile(file); }} />
            <Button type="button" variant="secondary" icon={<FileUp size={15} aria-hidden="true" />} loading={pending} onClick={() => fileRef.current?.click()}>Ganti PDF</Button>
            <span className="text-xs text-text-muted">PDF privat, maksimal 20 MB. Batas per halaman: 100 halaman.</span>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <Field label="Bagian" htmlFor="pdf-section"><Select id="pdf-section" value={section} onChange={(event) => setSection(event.target.value as "reading" | "listening")} disabled={disabled || pending}><option value="reading">Reading</option><option value="listening">Listening</option></Select></Field>
          <Field label="Halaman PDF" htmlFor="pdf-page"><div className="flex items-center gap-2"><Button type="button" variant="secondary" size="sm" onClick={() => setPageNumber((p) => Math.max(1, p - 1))} disabled={pageNumber <= 1 || pending}>Sebelumnya</Button><Input id="pdf-page" type="number" min={1} max={pageCount || 100} value={pageNumber} onChange={(event) => setPageNumber(Math.max(1, Number(event.target.value) || 1))} className="w-20" disabled={pending} /><span className="text-xs text-text-muted">dari {pageCount || "…"}</span><Button type="button" variant="secondary" size="sm" onClick={() => setPageNumber((p) => Math.min(pageCount || 100, p + 1))} disabled={pageNumber >= pageCount || pending}>Berikutnya</Button></div></Field>
        </div>

        <div className="max-h-[75vh] overflow-auto border border-border bg-surface-muted p-2">
          <div ref={pageRef} onClick={addMarker} style={{ width: pageWidth || "100%", height: pageHeight || undefined }} className="relative mx-auto cursor-crosshair bg-white">
            {loading ? <p className="p-6 text-sm text-text-muted">Memuat halaman PDF…</p> : null}
            {markers.map((marker) => (
              <button key={marker.label} type="button" title={`Opsi ${marker.label}`} onClick={(event) => { event.stopPropagation(); setMarkers((items) => items.filter((item) => item.label !== marker.label)); }} style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%`, width: `${marker.width * 100}%`, height: `${marker.height * 100}%` }} className="absolute z-10 flex items-center justify-center rounded-full border-2 border-[#9E2A2B] bg-white/70 font-mono text-sm font-bold text-[#9E2A2B]">{marker.label}</button>
            ))}
          </div>
        </div>

        <Alert tone="info">Cara pakai: pilih opsi teks di bawah, lalu klik posisi lingkaran pada soal PDF untuk menaruh bulatan A/B/C/D. Klik bulatan yang ada untuk menghapus. Kunci jawaban dipilih terpisah, tidak tampak bagi murid.</Alert>
        <Field label="Prompt soal / instruksi" htmlFor="pdf-overlay-prompt" required><Textarea id="pdf-overlay-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Contoh: Pilih gambar yang sesuai dengan audio." maxLength={4000} disabled={disabled || pending} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">{options.map((option, index) => <Field key={option.label} label={`Opsi ${option.label}`} htmlFor={`pdf-overlay-option-${option.label}`} required><div className="flex gap-2"><Input id={`pdf-overlay-option-${option.label}`} value={option.text} onChange={(event) => setOptions((items) => items.map((item) => item.label === option.label ? { ...item, text: event.target.value } : item))} className="font-cjk" lang="zh-Hans" disabled={disabled || pending} /><label className="flex items-center gap-1 text-xs"><input type="radio" name="pdf-overlay-key" checked={correctLabel === option.label} onChange={() => setCorrectLabel(option.label)} disabled={disabled || pending} />Kunci</label>{index > 1 ? <Button type="button" size="sm" variant="ghost" aria-label={`Hapus opsi ${option.label}`} onClick={() => { setOptions((items) => items.filter((item) => item.label !== option.label)); setMarkers((items) => items.filter((marker) => marker.label !== option.label)); if (correctLabel === option.label) setCorrectLabel("A"); }}><Trash2 size={14} aria-hidden="true" /></Button> : null}</div></Field>)}</div>
        {options.length < 5 ? <Button type="button" variant="secondary" size="sm" icon={<Plus size={14} aria-hidden="true" />} onClick={() => { const label = LETTERS[options.length]; setOptions((items) => [...items, { label, text: "" }]); }}>Tambah opsi</Button> : null}
        <div><Button type="button" onClick={saveQuestion} loading={pending} disabled={disabled || loading}>Simpan soal dan posisi lingkaran</Button></div>
      </div>
    </Card>
  );
}
