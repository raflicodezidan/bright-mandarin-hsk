"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  FileUp,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { PdfPageCanvas } from "@/components/pdf/pdf-page-canvas";
import { usePdfDocument } from "@/components/pdf/use-pdf-document";
import type { PdfOverlay } from "@/components/student/pdf-page-overlays";
import {
  removeTestPdfAction,
  savePdfBlankQuestionsAction,
  savePdfChoiceQuestionAction,
  savePdfMatchingQuestionAction,
  savePdfRearrangeQuestionAction,
  uploadTestPdfAction,
} from "@/app/admin/tests/actions";

type Mode = "choice" | "blank" | "matching" | "rearrange";
type Section = "listening" | "reading";
type Choice = { label: string; text: string };
type BlankDraft = {
  id: string;
  prompt: string;
  correctLabel: string;
  overlay: PdfOverlay | null;
};
type ItemDraft = { id: string; text: string };

const CHOICE_LABELS = ["A", "B", "C", "D", "E"] as const;
const BLANK_LABELS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function mediaUrl(path: string | null): string | null {
  if (!path) return null;
  return `/api/media?path=${encodeURIComponent(path)}`;
}

async function pdfHasAnswerKey(file: File): Promise<boolean> {
  const dynamicImport = new Function("url", "return import(url)");
  const pdfjs = (await dynamicImport("/pdf.min.mjs")) as typeof import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const pdf = await task.promise;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      // Deteksi heading bagian kunci jawaban (misalnya "Answer Key", "Kunci Jawaban",
      // "参考答案", atau "答案：" / "答案:"). Kata instruksi seperti "选择正确答案"
      // (Choose the correct answer) diizinkan dan tidak dianggap kunci jawaban.
      if (
        /answer\s*key|kunci\s*jawaban|参考答案|答案\s*[:：]|answer\s*sheet/i.test(
          text,
        )
      ) {
        return true;
      }
    }
    return false;
  } finally {
    await task.destroy();
  }
}

function markerButtonClass(kind: PdfOverlay["kind"]) {
  return kind === "choice" ? "rounded-full" : "rounded-[2px]";
}

export function PdfOverlayEditor({
  testId,
  pdfUrl,
  studentPdfUrl,
  disabled = false,
}: {
  testId: string;
  pdfUrl: string | null;
  studentPdfUrl: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [teacherUrl, setTeacherUrl] = React.useState(pdfUrl);
  const [studentUrl, setStudentUrl] = React.useState(studentPdfUrl);
  const teacherInputRef = React.useRef<HTMLInputElement>(null);
  const studentInputRef = React.useRef<HTMLInputElement>(null);

  const { pdf, error: pdfError, loading: pdfLoading, numPages } = usePdfDocument(teacherUrl);
  const [pageNumber, setPageNumber] = React.useState(1);
  const [mode, setMode] = React.useState<Mode>("choice");
  const [section, setSection] = React.useState<Section>("reading");
  const [prompt, setPrompt] = React.useState("Pilih jawaban yang benar.");

  const [options, setOptions] = React.useState<Choice[]>([
    { label: "A", text: "" },
    { label: "B", text: "" },
    { label: "C", text: "" },
    { label: "D", text: "" },
  ]);
  const [correctLabel, setCorrectLabel] = React.useState("A");
  const [choiceMarkers, setChoiceMarkers] = React.useState<PdfOverlay[]>([]);

  const [choices, setChoices] = React.useState<Choice[]>(
    BLANK_LABELS.slice(0, 6).map((label) => ({ label, text: "" })),
  );
  const [blanks, setBlanks] = React.useState<BlankDraft[]>([]);
  const [activeBlankId, setActiveBlankId] = React.useState<string | null>(null);

  const [leftItems, setLeftItems] = React.useState<ItemDraft[]>([
    { id: uid("left"), text: "Nomor 11" },
    { id: uid("left"), text: "Nomor 12" },
  ]);
  const [rightItems, setRightItems] = React.useState<ItemDraft[]>([
    { id: uid("right"), text: "" },
    { id: uid("right"), text: "" },
  ]);
  const [matches, setMatches] = React.useState<Record<string, string>>({});
  const [matchMarkers, setMatchMarkers] = React.useState<PdfOverlay[]>([]);
  const [activeLeftId, setActiveLeftId] = React.useState<string | null>(
    leftItems[0]?.id ?? null,
  );

  const [tokens, setTokens] = React.useState<ItemDraft[]>([
    { id: uid("token"), text: "" },
    { id: uid("token"), text: "" },
    { id: uid("token"), text: "" },
  ]);
  const [rearrangeMarker, setRearrangeMarker] = React.useState<PdfOverlay | null>(null);

  const markers = React.useMemo(() => {
    if (mode === "choice") return choiceMarkers;
    if (mode === "blank") {
      return blanks
        .map((blank) => blank.overlay)
        .filter((overlay): overlay is PdfOverlay => Boolean(overlay));
    }
    if (mode === "matching") return matchMarkers;
    return rearrangeMarker ? [rearrangeMarker] : [];
  }, [mode, choiceMarkers, blanks, matchMarkers, rearrangeMarker]);

  const visibleMarkers = markers.filter((marker) => marker.pageNumber === pageNumber);

  function resetDraft() {
    setError(null);
    setNotice(null);
    if (mode === "choice") {
      setChoiceMarkers([]);
      setOptions([
        { label: "A", text: "" },
        { label: "B", text: "" },
        { label: "C", text: "" },
        { label: "D", text: "" },
      ]);
      setCorrectLabel("A");
    } else if (mode === "blank") {
      setBlanks([]);
      setActiveBlankId(null);
    } else if (mode === "matching") {
      setMatchMarkers([]);
      setMatches({});
      setActiveLeftId(leftItems[0]?.id ?? null);
    } else {
      setRearrangeMarker(null);
    }
  }

  function addMarker(event: React.MouseEvent<HTMLDivElement>) {
    if (disabled || !pdf) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 0.95);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 0.95);

    if (mode === "choice") {
      const next = CHOICE_LABELS.find(
        (label) => !choiceMarkers.some((marker) => marker.label === label),
      );
      if (!next) {
        setError("Maksimal lima lingkaran opsi per soal.");
        return;
      }
      setChoiceMarkers((current) => [
        ...current,
        {
          id: next,
          kind: "choice",
          pageNumber,
          label: next,
          x,
          y,
          width: 0.045,
          height: 0.045,
        },
      ]);
      return;
    }

    if (mode === "blank") {
      const targetId = activeBlankId ?? blanks[0]?.id;
      if (!targetId) {
        setError("Tambahkan titik kosong terlebih dahulu.");
        return;
      }
      setBlanks((current) =>
        current.map((blank) =>
          blank.id === targetId
            ? {
                ...blank,
                overlay: {
                  id: blank.id,
                  kind: "blank",
                  pageNumber,
                  label: String(current.indexOf(blank) + 1),
                  x,
                  y,
                  width: 0.075,
                  height: 0.035,
                },
              }
            : blank,
        ),
      );
      return;
    }

    if (mode === "matching") {
      const targetId = activeLeftId ?? leftItems[0]?.id;
      if (!targetId) {
        setError("Tambahkan nomor matching terlebih dahulu.");
        return;
      }
      const index = leftItems.findIndex((item) => item.id === targetId);
      setMatchMarkers((current) => [
        ...current.filter((marker) => marker.id !== targetId),
        {
          id: targetId,
          kind: "match",
          pageNumber,
          label: leftItems[index]?.text.slice(0, 8) || String(index + 1),
          x,
          y,
          width: 0.05,
          height: 0.04,
        },
      ]);
      return;
    }

    setRearrangeMarker({
      id: "rearrange",
      kind: "drop",
      pageNumber,
      label: "Susun",
      x,
      y,
      width: 0.18,
      height: 0.05,
    });
  }

  function removeMarker(id: string) {
    if (disabled) return;
    if (mode === "choice") {
      setChoiceMarkers((current) => current.filter((marker) => marker.id !== id));
    } else if (mode === "blank") {
      setBlanks((current) =>
        current.map((blank) => (blank.id === id ? { ...blank, overlay: null } : blank)),
      );
    } else if (mode === "matching") {
      setMatchMarkers((current) => current.filter((marker) => marker.id !== id));
    } else {
      setRearrangeMarker(null);
    }
  }

  function uploadPdf(file: File | undefined, kind: "teacher" | "student") {
    if (!file) return;
    setError(null);
    setNotice(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Pilih file PDF.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError("Ukuran PDF maksimal 20 MB.");
      return;
    }

    startTransition(async () => {
      if (kind === "student") {
        try {
          if (await pdfHasAnswerKey(file)) {
            setError(
              "PDF murid terdeteksi memuat halaman kunci jawaban. Hapus halaman kunci terlebih dahulu, lalu unggah ulang.",
            );
            return;
          }
        } catch {
          setError("PDF tidak dapat diperiksa. Pastikan file valid.");
          return;
        }
      }
      const result = await uploadTestPdfAction(testId, file, kind);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const url = result.data.url ?? mediaUrl(result.data.path);
      if (kind === "teacher") {
        setTeacherUrl(url);
        setPageNumber(1);
        setChoiceMarkers([]);
        setBlanks([]);
        setMatchMarkers([]);
        setRearrangeMarker(null);
        setNotice("PDF guru diunggah. Posisikan lingkaran/titik pada halaman asli.");
      } else {
        setStudentUrl(url);
        setNotice("PDF murid diunggah. Murid akan melihat PDF ini saat mengerjakan.");
      }
      router.refresh();
    });
  }

  function removePdf(kind: "teacher" | "student") {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await removeTestPdfAction(testId, kind);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (kind === "teacher") {
        setTeacherUrl(null);
        setPageNumber(1);
      } else {
        setStudentUrl(null);
      }
      toast(kind === "teacher" ? "PDF guru dihapus." : "PDF murid dihapus.");
      router.refresh();
    });
  }

  function addOption() {
    const label = CHOICE_LABELS[options.length];
    if (!label) return;
    setOptions((current) => [...current, { label, text: "" }]);
  }

  function removeOption(label: string) {
    setOptions((current) => current.filter((option) => option.label !== label));
    setChoiceMarkers((current) => current.filter((marker) => marker.label !== label));
    if (correctLabel === label) setCorrectLabel("A");
  }

  function addBlank() {
    const index = blanks.length;
    const blank: BlankDraft = {
      id: uid("blank"),
      prompt: `Nomor ${index + 1}`,
      correctLabel: choices[0]?.label ?? "a",
      overlay: null,
    };
    setBlanks((current) => [...current, blank]);
    setActiveBlankId(blank.id);
  }

  function removeBlank(id: string) {
    setBlanks((current) => current.filter((blank) => blank.id !== id));
    if (activeBlankId === id) setActiveBlankId(null);
  }

  function addLeftItem() {
    if (leftItems.length >= 10) return;
    const item = { id: uid("left"), text: "" };
    setLeftItems((current) => [...current, item]);
    if (!activeLeftId) setActiveLeftId(item.id);
  }

  function removeLeftItem(id: string) {
    setLeftItems((current) => current.filter((item) => item.id !== id));
    setMatchMarkers((current) => current.filter((marker) => marker.id !== id));
    setMatches((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    if (activeLeftId === id) setActiveLeftId(null);
  }

  function addRightItem() {
    if (rightItems.length >= 10) return;
    setRightItems((current) => [...current, { id: uid("right"), text: "" }]);
  }

  function removeRightItem(id: string) {
    setRightItems((current) => current.filter((item) => item.id !== id));
    setMatches((current) => {
      const next = { ...current };
      for (const [leftId, rightId] of Object.entries(next)) {
        if (rightId === id) delete next[leftId];
      }
      return next;
    });
  }

  function addToken() {
    if (tokens.length >= 30) return;
    setTokens((current) => [...current, { id: uid("token"), text: "" }]);
  }

  function moveToken(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= tokens.length) return;
    setTokens((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function save() {
    setError(null);
    setNotice(null);

    if (mode === "choice") {
      if (!prompt.trim()) return setError("Prompt soal wajib diisi.");
      if (options.length < 2 || options.some((option) => !option.text.trim())) {
        return setError("Semua opsi wajib diisi.");
      }
      if (
        choiceMarkers.length !== options.length ||
        new Set(choiceMarkers.map((marker) => marker.label)).size !== options.length
      ) {
        return setError("Letakkan satu lingkaran untuk setiap opsi.");
      }
      startTransition(async () => {
        const result = await savePdfChoiceQuestionAction({
          testId,
          prompt,
          section,
          options,
          overlays: choiceMarkers,
          correctLabel,
        });
        if (!result.ok) return setError(result.error);
        toast("Soal pilihan ganda PDF disimpan.");
        resetDraft();
        router.refresh();
      });
      return;
    }

    if (mode === "blank") {
      if (choices.length < 2 || choices.some((choice) => !choice.text.trim())) {
        return setError("Semua opsi Hanzi wajib diisi.");
      }
      if (blanks.length === 0) return setError("Tambahkan minimal satu titik kosong.");
      if (blanks.some((blank) => !blank.overlay)) {
        return setError("Setiap titik kosong harus ditandai pada halaman PDF.");
      }
      if (blanks.some((blank) => !blank.prompt.trim())) {
        return setError("Label setiap titik kosong wajib diisi.");
      }
      startTransition(async () => {
        const result = await savePdfBlankQuestionsAction({
          testId,
          section,
          choices,
          blanks: blanks.map((blank) => ({
            id: blank.id,
            prompt: blank.prompt,
            correctLabel: blank.correctLabel,
            overlay: blank.overlay!,
          })),
        });
        if (!result.ok) return setError(result.error);
        toast(`${result.data.questionIds.length} soal isian PDF disimpan.`);
        resetDraft();
        router.refresh();
      });
      return;
    }

    if (mode === "matching") {
      if (!prompt.trim()) return setError("Prompt soal wajib diisi.");
      if (leftItems.length < 2 || leftItems.some((item) => !item.text.trim())) {
        return setError("Minimal dua nomor matching dan semua teksnya wajib diisi.");
      }
      if (rightItems.length < 2 || rightItems.some((item) => !item.text.trim())) {
        return setError("Minimal dua pilihan pasangan dan semua teksnya wajib diisi.");
      }
      if (matchMarkers.length !== leftItems.length) {
        return setError("Setiap nomor matching harus ditandai pada halaman PDF.");
      }
      if (
        Object.keys(matches).length !== leftItems.length ||
        new Set(Object.values(matches)).size !== leftItems.length
      ) {
        return setError("Pasangkan semua nomor matching dengan pilihan yang berbeda.");
      }
      startTransition(async () => {
        const result = await savePdfMatchingQuestionAction({
          testId,
          section,
          prompt,
          leftItems,
          rightItems,
          matches,
          overlays: matchMarkers,
        });
        if (!result.ok) return setError(result.error);
        toast("Soal matching PDF disimpan.");
        resetDraft();
        router.refresh();
      });
      return;
    }

    if (!prompt.trim()) return setError("Prompt soal wajib diisi.");
    if (tokens.length < 2 || tokens.some((token) => !token.text.trim())) {
      return setError("Minimal dua potongan kalimat dan semua teksnya wajib diisi.");
    }
    startTransition(async () => {
      const result = await savePdfRearrangeQuestionAction({
        testId,
        section,
        prompt,
        tokens,
        order: tokens.map((token) => token.id),
        overlays: rearrangeMarker ? [rearrangeMarker] : [],
      });
      if (!result.ok) return setError(result.error);
      toast("Soal susun kalimat PDF disimpan.");
      resetDraft();
      router.refresh();
    });
  }

  const teacherReady = Boolean(teacherUrl);
  const studentReady = Boolean(studentUrl);

  return (
    <Card
      title="Soal di atas PDF asli"
      description="PDF guru menjadi latar. Owner/guru menaruh lingkaran atau titik kosong; murid melihat PDF murid yang bersih."
    >
      <div className="flex flex-col gap-5">
        <Alert tone="info">
          PDF guru boleh memuat kunci dan hanya dipakai di halaman ini. PDF murid
          wajib tanpa halaman kunci; unggah salinan bersih secara terpisah.
        </Alert>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 border border-border p-3">
            <p className="text-xs font-medium text-text">PDF guru (referensi)</p>
            <p className="text-xs text-text-muted">
              {teacherReady ? "Sudah diunggah." : "Belum ada PDF guru."}
            </p>
            <input
              ref={teacherInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              disabled={disabled || pending}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                uploadPdf(file, "teacher");
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={<FileUp size={14} strokeWidth={1.5} aria-hidden="true" />}
                loading={pending}
                disabled={disabled || pending}
                onClick={() => teacherInputRef.current?.click()}
              >
                {teacherReady ? "Ganti PDF guru" : "Unggah PDF guru"}
              </Button>
              {teacherReady ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />}
                  disabled={disabled || pending}
                  onClick={() => removePdf("teacher")}
                >
                  Hapus
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2 border border-border p-3">
            <p className="text-xs font-medium text-text">PDF murid (tanpa kunci)</p>
            <p className="text-xs text-text-muted">
              {studentReady
                ? "Sudah diunggah. PDF ini yang dilihat murid."
                : "Belum ada PDF murid. Soal PDF tidak akan tampil pada murid."}
            </p>
            <input
              ref={studentInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              disabled={disabled || pending}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                uploadPdf(file, "student");
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={<FileUp size={14} strokeWidth={1.5} aria-hidden="true" />}
                loading={pending}
                disabled={disabled || pending}
                onClick={() => studentInputRef.current?.click()}
              >
                {studentReady ? "Ganti PDF murid" : "Unggah PDF murid"}
              </Button>
              {studentReady ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />}
                  disabled={disabled || pending}
                  onClick={() => removePdf("student")}
                >
                  Hapus
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert tone="info">{notice}</Alert> : null}

        {disabled ? (
          <Alert tone="warning">
            Tes sudah memiliki pengerjaan. PDF dan posisi soal tidak dapat diubah.
          </Alert>
        ) : null}

        {!teacherReady ? (
          <p className="text-sm text-text-muted">
            Unggah PDF guru terlebih dahulu untuk mulai menaruh posisi soal.
          </p>
        ) : pdfLoading ? (
          <p className="text-sm text-text-muted">Memuat PDF…</p>
        ) : pdfError ? (
          <Alert tone="error">{pdfError}</Alert>
        ) : pdf ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Halaman" htmlFor="pdf-page">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setPageNumber((value) => Math.max(1, value - 1))}
                      disabled={pageNumber <= 1 || pending}
                      aria-label="Halaman sebelumnya"
                    >
                      <ChevronLeft size={14} strokeWidth={1.5} aria-hidden="true" />
                    </Button>
                    <Input
                      id="pdf-page"
                      type="number"
                      min={1}
                      max={numPages || 1}
                      value={pageNumber}
                      onChange={(event) =>
                        setPageNumber(clamp(Number(event.target.value) || 1, 1, numPages || 1))
                      }
                      className="w-20"
                      disabled={pending}
                    />
                    <span className="text-xs text-text-muted">dari {numPages}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setPageNumber((value) => Math.min(numPages, value + 1))}
                      disabled={pageNumber >= numPages || pending}
                      aria-label="Halaman berikutnya"
                    >
                      <ChevronRight size={14} strokeWidth={1.5} aria-hidden="true" />
                    </Button>
                  </div>
                </Field>
                <p className="text-xs text-text-muted">
                  Klik halaman untuk menaruh penanda. Klik penanda untuk menghapus.
                </p>
              </div>

              <div className="max-h-[70vh] overflow-auto border border-border bg-surface-muted p-2">
                <PdfPageCanvas
                  pdf={pdf}
                  pageNumber={pageNumber}
                  onBackgroundClick={addMarker}
                  backgroundLabel={`Halaman ${pageNumber} PDF guru`}
                >
                  {visibleMarkers.map((marker) => (
                    <button
                      key={`${marker.kind}-${marker.id}`}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeMarker(marker.id);
                      }}
                      title="Klik untuk menghapus penanda"
                      aria-label={`Hapus penanda ${marker.label ?? marker.id}`}
                      style={{
                        left: `${marker.x * 100}%`,
                        top: `${marker.y * 100}%`,
                        width: `${marker.width * 100}%`,
                        height: `${marker.height * 100}%`,
                      }}
                      className={`absolute z-10 flex items-center justify-center border-2 border-primary bg-primary/10 px-1 font-mono text-[10px] font-bold text-primary ${markerButtonClass(marker.kind)}`}
                    >
                      <span className="max-w-full truncate">{marker.label ?? marker.id}</span>
                    </button>
                  ))}
                </PdfPageCanvas>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <Field label="Tipe soal PDF" htmlFor="pdf-mode" required>
                <Select
                  id="pdf-mode"
                  value={mode}
                  onChange={(event) => {
                    setMode(event.target.value as Mode);
                    setError(null);
                    setNotice(null);
                  }}
                  disabled={disabled || pending}
                >
                  <option value="choice">Pilihan ganda (lingkaran A–E)</option>
                  <option value="blank">Isian Hanzi (titik kosong)</option>
                  <option value="matching">Matching (nomor dan pasangan)</option>
                  <option value="rearrange">Susun kalimat</option>
                </Select>
              </Field>

              <Field label="Bagian" htmlFor="pdf-section" required>
                <Select
                  id="pdf-section"
                  value={section}
                  onChange={(event) => setSection(event.target.value as Section)}
                  disabled={disabled || pending}
                >
                  <option value="reading">Reading</option>
                  <option value="listening">Listening</option>
                </Select>
              </Field>

              <Field label="Prompt / instruksi" htmlFor="pdf-prompt" required>
                <Textarea
                  id="pdf-prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  maxLength={4000}
                  disabled={disabled || pending}
                  className="min-h-20"
                />
              </Field>

              {mode === "choice" ? (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-text-muted">
                    Isi teks opsi, lalu klik posisi lingkaran A–E pada PDF. Klik
                    penanda untuk menghapus dan menaruh ulang.
                  </p>
                  {options.map((option) => (
                    <div key={option.label} className="flex items-end gap-2">
                      <Field label={`Opsi ${option.label}`} htmlFor={`pdf-option-${option.label}`} className="flex-1">
                        <Input
                          id={`pdf-option-${option.label}`}
                          value={option.text}
                          onChange={(event) =>
                            setOptions((current) =>
                              current.map((item) =>
                                item.label === option.label
                                  ? { ...item, text: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          className="font-cjk"
                          lang="zh-Hans"
                          maxLength={2000}
                          disabled={disabled || pending}
                        />
                      </Field>
                      <label className="flex items-center gap-1 pb-2 text-xs">
                        <input
                          type="radio"
                          name="pdf-choice-key"
                          checked={correctLabel === option.label}
                          onChange={() => setCorrectLabel(option.label)}
                          disabled={disabled || pending}
                        />
                        Kunci
                      </label>
                      {options.length > 2 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={`Hapus opsi ${option.label}`}
                          onClick={() => removeOption(option.label)}
                          disabled={disabled || pending}
                          className="mb-1"
                        >
                          <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {options.length < 5 ? (
                    <div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        icon={<Plus size={14} strokeWidth={1.5} aria-hidden="true" />}
                        onClick={addOption}
                        disabled={disabled || pending}
                      >
                        Tambah opsi
                      </Button>
                    </div>
                  ) : null}
                  <p className="text-xs text-text-muted">
                    Lingkaran terpasang: {choiceMarkers.length} dari {options.length}.
                  </p>
                </div>
              ) : null}

              {mode === "blank" ? (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-text-muted">
                    Isi bank kata Hanzi (label a–f), tambahkan titik kosong, lalu
                    klik posisi setiap titik pada PDF. Setiap titik menjadi satu
                    soal bernilai 1.
                  </p>
                  {choices.map((choice) => (
                    <div key={choice.label} className="flex items-end gap-2">
                      <Field label={`Opsi ${choice.label}`} htmlFor={`pdf-choice-${choice.label}`} className="flex-1">
                        <Input
                          id={`pdf-choice-${choice.label}`}
                          value={choice.text}
                          onChange={(event) =>
                            setChoices((current) =>
                              current.map((item) =>
                                item.label === choice.label
                                  ? { ...item, text: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          className="font-cjk"
                          lang="zh-Hans"
                          maxLength={2000}
                          disabled={disabled || pending}
                        />
                      </Field>
                    </div>
                  ))}
                  <div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      icon={<Plus size={14} strokeWidth={1.5} aria-hidden="true" />}
                      onClick={addBlank}
                      disabled={disabled || pending}
                    >
                      Tambah titik kosong
                    </Button>
                  </div>
                  {blanks.map((blank, index) => (
                    <div key={blank.id} className="flex flex-col gap-2 border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium">
                          Titik {index + 1}{" "}
                          <span className="text-text-muted">
                            ({blank.overlay ? "sudah ditandai" : "belum ditandai"})
                          </span>
                        </p>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setActiveBlankId(blank.id)}
                            disabled={disabled || pending}
                          >
                            Tandai
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={`Hapus titik ${index + 1}`}
                            onClick={() => removeBlank(blank.id)}
                            disabled={disabled || pending}
                          >
                            <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                      <Field label="Label soal" htmlFor={`blank-prompt-${blank.id}`} required>
                        <Input
                          id={`blank-prompt-${blank.id}`}
                          value={blank.prompt}
                          onChange={(event) =>
                            setBlanks((current) =>
                              current.map((item) =>
                                item.id === blank.id
                                  ? { ...item, prompt: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          maxLength={4000}
                          disabled={disabled || pending}
                        />
                      </Field>
                      <Field label="Kunci Hanzi" htmlFor={`blank-key-${blank.id}`} required>
                        <Select
                          id={`blank-key-${blank.id}`}
                          value={blank.correctLabel}
                          onChange={(event) =>
                            setBlanks((current) =>
                              current.map((item) =>
                                item.id === blank.id
                                  ? { ...item, correctLabel: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          disabled={disabled || pending}
                        >
                          {choices.map((choice) => (
                            <option key={choice.label} value={choice.label}>
                              {choice.label}. {choice.text || "(kosong)"}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                  ))}
                </div>
              ) : null}

              {mode === "matching" ? (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-text-muted">
                    Isi nomor di kolom kiri dan pilihan di kolom kanan. Tandai
                    setiap nomor pada PDF, lalu pilih kuncinya. Satu soal matching
                    bernilai 1 jika semua pasangan benar.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium">Nomor (kiri)</p>
                      {leftItems.map((item, index) => (
                        <div key={item.id} className="flex items-center gap-1">
                          <Input
                            value={item.text}
                            onChange={(event) =>
                              setLeftItems((current) =>
                                current.map((row) =>
                                  row.id === item.id ? { ...row, text: event.target.value } : row,
                                ),
                              )
                            }
                            aria-label={`Nomor kiri ${index + 1}`}
                            maxLength={300}
                            disabled={disabled || pending}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant={activeLeftId === item.id ? "primary" : "secondary"}
                            onClick={() => setActiveLeftId(item.id)}
                            disabled={disabled || pending}
                          >
                            Tandai
                          </Button>
                          {leftItems.length > 2 ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              aria-label={`Hapus nomor ${index + 1}`}
                              onClick={() => removeLeftItem(item.id)}
                              disabled={disabled || pending}
                            >
                              <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                            </Button>
                          ) : null}
                        </div>
                      ))}
                      {leftItems.length < 10 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          icon={<Plus size={14} strokeWidth={1.5} aria-hidden="true" />}
                          onClick={addLeftItem}
                          disabled={disabled || pending}
                        >
                          Tambah nomor
                        </Button>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium">Pilihan (kanan)</p>
                      {rightItems.map((item, index) => (
                        <div key={item.id} className="flex items-center gap-1">
                          <Input
                            value={item.text}
                            onChange={(event) =>
                              setRightItems((current) =>
                                current.map((row) =>
                                  row.id === item.id ? { ...row, text: event.target.value } : row,
                                ),
                              )
                            }
                            aria-label={`Pilihan kanan ${index + 1}`}
                            maxLength={300}
                            disabled={disabled || pending}
                          />
                          {rightItems.length > 2 ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              aria-label={`Hapus pilihan ${index + 1}`}
                              onClick={() => removeRightItem(item.id)}
                              disabled={disabled || pending}
                            >
                              <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                            </Button>
                          ) : null}
                        </div>
                      ))}
                      {rightItems.length < 10 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          icon={<Plus size={14} strokeWidth={1.5} aria-hidden="true" />}
                          onClick={addRightItem}
                          disabled={disabled || pending}
                        >
                          Tambah pilihan
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium">Kunci pasangan</p>
                    {leftItems.map((item) => (
                      <Field key={item.id} label={item.text || "Nomor"} htmlFor={`pdf-match-${item.id}`}>
                        <Select
                          id={`pdf-match-${item.id}`}
                          value={matches[item.id] ?? ""}
                          onChange={(event) =>
                            setMatches((current) => ({ ...current, [item.id]: event.target.value }))
                          }
                          disabled={disabled || pending}
                        >
                          <option value="">Pilih pasangan</option>
                          {rightItems.map((right, index) => (
                            <option key={right.id} value={right.id}>
                              {String.fromCharCode(65 + index)}. {right.text || "(kosong)"}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    ))}
                  </div>
                </div>
              ) : null}

              {mode === "rearrange" ? (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-text-muted">
                    Susun potongan dalam urutan benar. Urutan ini menjadi kunci.
                    Klik PDF untuk menandai area jawaban (opsional).
                  </p>
                  {tokens.map((token, index) => (
                    <div key={token.id} className="flex items-center gap-1">
                      <span className="w-6 font-mono text-xs text-text-muted">{index + 1}</span>
                      <Input
                        value={token.text}
                        onChange={(event) =>
                          setTokens((current) =>
                            current.map((row) =>
                              row.id === token.id ? { ...row, text: event.target.value } : row,
                            ),
                          )
                        }
                        className="font-cjk"
                        lang="zh-Hans"
                        aria-label={`Potongan ${index + 1}`}
                        maxLength={300}
                        disabled={disabled || pending}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Naikkan potongan ${index + 1}`}
                        onClick={() => moveToken(index, -1)}
                        disabled={disabled || pending || index === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Turunkan potongan ${index + 1}`}
                        onClick={() => moveToken(index, 1)}
                        disabled={disabled || pending || index === tokens.length - 1}
                      >
                        ↓
                      </Button>
                      {tokens.length > 2 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={`Hapus potongan ${index + 1}`}
                          onClick={() =>
                            setTokens((current) => current.filter((row) => row.id !== token.id))
                          }
                          disabled={disabled || pending}
                        >
                          <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {tokens.length < 30 ? (
                    <div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        icon={<Plus size={14} strokeWidth={1.5} aria-hidden="true" />}
                        onClick={addToken}
                        disabled={disabled || pending}
                      >
                        Tambah potongan
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  onClick={save}
                  loading={pending}
                  disabled={disabled || !teacherReady}
                  icon={<Save size={15} strokeWidth={1.5} aria-hidden="true" />}
                >
                  Simpan soal PDF
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={resetDraft}
                  disabled={pending}
                >
                  Bersihkan form
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
