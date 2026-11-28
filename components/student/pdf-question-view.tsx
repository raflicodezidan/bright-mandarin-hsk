"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  PdfQuestionDocument,
  type PdfOverlay,
} from "@/components/student/pdf-page-overlays";
import { shuffleForSeed } from "@/lib/shuffle";
import { cn } from "@/lib/utils";

export type PdfTakeQuestion = {
  id: string;
  number: number;
  section: "listening" | "reading";
  prompt: string;
  imagePath: string | null;
  audioPath: string | null;
  pdfPath: string | null;
  pdfOverlays: PdfOverlay[];
  options: { id: string; label: string; text: string; imagePath?: string | null; imageUrl?: string | null }[];
  questionType: "multiple_choice" | "matching" | "hanzi_blank" | "rearrange_sentence";
  interactionConfig: unknown;
};

type Config = {
  choices?: { label: string; text: string }[];
  leftItems?: { id: string; text: string }[];
  rightItems?: { id: string; text: string }[];
  tokens?: { id: string; text: string }[];
  overlays?: PdfOverlay[];
};

function mediaUrl(path: string | null): string | null {
  if (!path) return null;
  return `/api/media?path=${encodeURIComponent(path)}`;
}

function letter(index: number): string {
  return String.fromCharCode(65 + index);
}

function PromptText({ prompt }: { prompt: string }) {
  const parts = prompt.split("{{blank}}");
  if (parts.length === 1) return <>{prompt}</>;
  return (
    <>
      {parts.map((part, index) => (
        <React.Fragment key={index}>
          {part}
          {index < parts.length - 1 ? (
            <span
              aria-label="bagian kosong"
              className="mx-1 inline-block min-w-16 border-b border-text align-middle"
            />
          ) : null}
        </React.Fragment>
      ))}
    </>
  );
}

function OptionButton({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "flex min-h-12 w-full items-center gap-3 rounded-[2px] border px-3 py-2 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        selected
          ? "border-2 border-primary bg-primary-subtle"
          : "border-border-strong bg-surface hover:bg-surface-muted",
        disabled && "cursor-default",
      )}
    >
      {children}
    </button>
  );
}

// ─── Hanzi Blank dengan popup pilihan ───────────────────────────────────────

function HanziBlankView({
  config,
  answer,
  disabled,
  onChange,
}: {
  config: Config;
  answer: Record<string, unknown>;
  disabled: boolean;
  onChange?: (answer: Record<string, unknown>) => void;
}) {
  const [openPopup, setOpenPopup] = React.useState(false);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const selectedLabel = typeof answer.selectedLabel === "string" ? answer.selectedLabel : null;
  const selectedText = config.choices?.find((c) => c.label === selectedLabel)?.text;

  // Tutup popup jika klik di luar
  React.useEffect(() => {
    if (!openPopup) return;
    function handler(e: MouseEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpenPopup(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openPopup]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-muted">
        Klik kotak kosong untuk memilih kata Hanzi yang tepat.
      </p>
      <div className="relative inline-flex items-center gap-2 font-cjk text-question" lang="zh-Hans">
        {/* Kotak kosong yang bisa diklik */}
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpenPopup((v) => !v)}
          aria-label="Pilih kata Hanzi"
          aria-expanded={openPopup}
          className={cn(
            "relative inline-flex min-w-24 items-center justify-between gap-2 rounded-[3px] border-2 px-3 py-1 font-cjk text-base transition-colors",
            selectedLabel
              ? "border-primary bg-primary-subtle text-primary"
              : "border-border-strong bg-surface text-text-muted hover:border-primary",
            disabled && "cursor-default opacity-70",
          )}
        >
          <span>{selectedText ?? "___"}</span>
          {selectedLabel && !disabled ? (
            <span
              role="button"
              aria-label="Hapus pilihan"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange?.({});
                setOpenPopup(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onChange?.({});
                  setOpenPopup(false);
                }
              }}
              className="shrink-0 rounded-sm text-primary hover:text-text"
            >
              <X size={12} strokeWidth={2} aria-hidden="true" />
            </span>
          ) : null}
        </button>

        {/* Popup pilihan */}
        {openPopup && !disabled ? (
          <div
            ref={popupRef}
            role="listbox"
            aria-label="Pilihan kata Hanzi"
            className="absolute left-0 top-full z-50 mt-1 min-w-48 rounded-[3px] border border-border-strong bg-surface shadow-sm"
          >
            <div className="flex flex-col gap-0 py-1">
              {(config.choices ?? []).map((choice, idx) => {
                const isSelected = selectedLabel === choice.label;
                return (
                  <button
                    key={choice.label}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange?.({ selectedLabel: choice.label });
                      setOpenPopup(false);
                    }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-left font-cjk text-sm transition-colors",
                      isSelected
                        ? "bg-primary-subtle text-primary"
                        : "hover:bg-surface-muted",
                    )}
                  >
                    <span className="shrink-0 font-mono text-xs text-text-muted">
                      {letter(idx)}.
                    </span>
                    <span lang="zh-Hans">{choice.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Matching dengan garis SVG penghubung ───────────────────────────────────

function MatchingView({
  config,
  matches,
  disabled,
  onAssign,
  onClear,
}: {
  config: Config;
  matches: Record<string, string>;
  disabled: boolean;
  onAssign: (leftId: string, rightId: string) => void;
  onClear: (leftId: string) => void;
}) {
  const [pendingLeft, setPendingLeft] = React.useState<string | null>(null);
  const leftRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const rightRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Hitung koordinat garis berdasarkan posisi elemen
  const [lines, setLines] = React.useState<
    { leftId: string; rightId: string; x1: number; y1: number; x2: number; y2: number }[]
  >([]);

  const recalcLines = React.useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cr = container.getBoundingClientRect();
    const newLines = Object.entries(matches)
      .map(([leftId, rightId]) => {
        const lEl = leftRefs.current[leftId];
        const rEl = rightRefs.current[rightId];
        if (!lEl || !rEl) return null;
        const lr = lEl.getBoundingClientRect();
        const rr = rEl.getBoundingClientRect();
        return {
          leftId,
          rightId,
          x1: lr.right - cr.left,
          y1: lr.top + lr.height / 2 - cr.top,
          x2: rr.left - cr.left,
          y2: rr.top + rr.height / 2 - cr.top,
        };
      })
      .filter(Boolean) as typeof lines;
    setLines(newLines);
  }, [matches]);

  // Recalc saat match berubah atau resize
  React.useEffect(() => {
    recalcLines();
    const obs = new ResizeObserver(recalcLines);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [recalcLines]);

  function handleClickLeft(id: string) {
    if (disabled) return;
    if (matches[id]) {
      // Sudah punya pasangan: klik lagi untuk hapus
      onClear(id);
      if (pendingLeft === id) setPendingLeft(null);
      return;
    }
    setPendingLeft((prev) => (prev === id ? null : id));
  }

  function handleClickRight(id: string) {
    if (disabled) return;
    // Jika right sudah dipakai: hapus pasangan lama dulu
    const existingLeft = Object.keys(matches).find((k) => matches[k] === id);
    if (existingLeft && !pendingLeft) {
      onClear(existingLeft);
      return;
    }
    if (!pendingLeft) return;
    onAssign(pendingLeft, id);
    // Lanjut ke kiri berikutnya yang belum punya pasangan
    const lefts = config.leftItems ?? [];
    const nextLeft = lefts.find((item) => item.id !== pendingLeft && !matches[item.id]);
    setPendingLeft(nextLeft?.id ?? null);
  }

  const leftItems = config.leftItems ?? [];
  const rightItems = config.rightItems ?? [];
  const pairedCount = Object.keys(matches).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-muted">
        Klik item di kolom kiri, lalu klik pasangannya di kanan. Klik item yang sudah
        terpasang untuk melepasnya.
      </p>
      <p className="text-xs font-medium text-text">
        {pairedCount} dari {leftItems.length} pasangan terisi
      </p>

      {/* Container relatif agar SVG bisa overlay */}
      <div ref={containerRef} className="relative">
        {/* Garis SVG */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          {lines.map((line) => (
            <line
              key={`${line.leftId}-${line.rightId}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="var(--color-primary, #5a7a5a)"
              strokeWidth={2}
              strokeDasharray="0"
              markerEnd="url(#arrow)"
            />
          ))}
          <defs>
            <marker
              id="arrow"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path
                d="M0,0 L0,6 L6,3 z"
                fill="var(--color-primary, #5a7a5a)"
              />
            </marker>
          </defs>
        </svg>

        {/* Dua kolom */}
        <div className="grid grid-cols-2 gap-x-10 gap-y-2">
          {/* Kolom kiri */}
          <div className="flex flex-col gap-2">
            {leftItems.map((item, idx) => {
              const isPaired = Boolean(matches[item.id]);
              const isPending = pendingLeft === item.id;
              return (
                <button
                  key={item.id}
                  ref={(el) => { leftRefs.current[item.id] = el; }}
                  type="button"
                  onClick={() => handleClickLeft(item.id)}
                  disabled={disabled}
                  aria-pressed={isPending}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2 rounded-[3px] border-2 px-3 py-2 text-left text-sm transition-colors",
                    isPending
                      ? "border-primary bg-primary-subtle"
                      : isPaired
                        ? "border-primary/40 bg-primary-subtle/40"
                        : "border-border-strong bg-surface hover:border-primary hover:bg-surface-muted",
                    disabled && "cursor-default",
                  )}
                >
                  <span className="shrink-0 font-mono text-xs text-text-muted">{idx + 1}.</span>
                  <span className="font-cjk" lang="zh-Hans">{item.text}</span>
                  {isPaired ? (
                    <span className="ml-auto shrink-0 font-mono text-xs font-bold text-primary">
                      {letter(rightItems.findIndex((r) => r.id === matches[item.id]))}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Kolom kanan */}
          <div className="flex flex-col gap-2">
            {rightItems.map((item, idx) => {
              const isMatchedByActive = pendingLeft ? matches[pendingLeft] === item.id : false;
              const isUsed = Object.values(matches).includes(item.id);
              return (
                <button
                  key={item.id}
                  ref={(el) => { rightRefs.current[item.id] = el; }}
                  type="button"
                  onClick={() => handleClickRight(item.id)}
                  disabled={disabled}
                  aria-pressed={isMatchedByActive}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2 rounded-[3px] border-2 px-3 py-2 text-left text-sm transition-colors",
                    isMatchedByActive
                      ? "border-primary bg-primary-subtle"
                      : isUsed
                        ? "border-primary/40 bg-primary-subtle/40"
                        : pendingLeft
                          ? "border-border-strong bg-surface hover:border-primary hover:bg-surface-muted"
                          : "border-border-strong bg-surface",
                    disabled && "cursor-default",
                  )}
                >
                  <span className="shrink-0 font-mono text-xs font-semibold text-text-muted">
                    {letter(idx)}.
                  </span>
                  <span className="font-cjk" lang="zh-Hans">{item.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {pairedCount > 0 && !disabled ? (
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => { setPendingLeft(null); onClear("__all__"); }}
            disabled={disabled}
          >
            Hapus semua pasangan
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// ─── Rearrange: chip klik untuk menyusun ─────────────────────────────────────

function RearrangeView({
  config,
  questionId,
  answer,
  disabled,
  onChange,
}: {
  config: Config;
  questionId: string;
  answer: Record<string, unknown>;
  disabled: boolean;
  onChange?: (answer: Record<string, unknown>) => void;
}) {
  const tokens = React.useMemo(() => config.tokens ?? [], [config.tokens]);

  // Urutan slot yang sudah disusun murid (berisi token id)
  const [arranged, setArranged] = React.useState<string[]>(() => {
    const saved = answer.order as string[] | undefined;
    return saved ?? [];
  });

  // Chip yang belum masuk ke slot (diacak deterministik)
  const shuffledAll = React.useMemo(
    () => shuffleForSeed(tokens.map((t) => t.id), questionId),
    [tokens, questionId],
  );

  const remaining = shuffledAll.filter((id) => !arranged.includes(id));

  function addToArranged(tokenId: string) {
    if (disabled) return;
    const next = [...arranged, tokenId];
    setArranged(next);
    onChange?.({ order: next });
  }

  function removeFromArranged(index: number) {
    if (disabled) return;
    const next = arranged.filter((_, i) => i !== index);
    setArranged(next);
    onChange?.({ order: next });
  }

  function resetAll() {
    setArranged([]);
    onChange?.({ order: [] });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-text-muted">
        Klik kata untuk menyusun kalimat. Klik kata di susunan untuk mengembalikannya.
      </p>

      {/* Area susunan */}
      <div className="flex min-h-14 flex-wrap items-center gap-2 rounded-[3px] border-2 border-dashed border-border-strong bg-surface-muted p-3">
        {arranged.length === 0 ? (
          <span className="text-xs text-text-muted">Susunan kalimat muncul di sini...</span>
        ) : (
          arranged.map((tokenId, idx) => {
            const token = tokens.find((t) => t.id === tokenId);
            if (!token) return null;
            return (
              <button
                key={`${tokenId}-${idx}`}
                type="button"
                onClick={() => removeFromArranged(idx)}
                disabled={disabled}
                title="Klik untuk kembalikan"
                className={cn(
                  "flex items-center gap-1 rounded-[3px] border border-primary bg-primary-subtle px-3 py-1 font-cjk text-sm text-primary transition-colors",
                  !disabled && "hover:bg-primary hover:text-white",
                  disabled && "cursor-default opacity-70",
                )}
                lang="zh-Hans"
              >
                <span className="font-mono text-xs opacity-60">{idx + 1}.</span>
                {token.text}
                {!disabled ? (
                  <X size={11} strokeWidth={2.5} aria-hidden="true" className="ml-1 opacity-60" />
                ) : null}
              </button>
            );
          })
        )}
      </div>

      {/* Chip yang belum dipakai */}
      <div className="flex flex-wrap gap-2">
        {remaining.map((tokenId) => {
          const token = tokens.find((t) => t.id === tokenId);
          if (!token) return null;
          return (
            <button
              key={tokenId}
              type="button"
              onClick={() => addToArranged(tokenId)}
              disabled={disabled}
              className={cn(
                "rounded-[3px] border border-border-strong bg-surface px-3 py-1 font-cjk text-sm transition-colors",
                !disabled && "hover:border-primary hover:bg-primary-subtle hover:text-primary",
                disabled && "cursor-default opacity-70",
              )}
              lang="zh-Hans"
            >
              {token.text}
            </button>
          );
        })}
        {remaining.length === 0 && arranged.length > 0 ? (
          <span className="text-xs text-text-muted">Semua kata sudah tersusun.</span>
        ) : null}
      </div>

      {arranged.length > 0 && !disabled ? (
        <div>
          <Button type="button" variant="secondary" size="sm" onClick={resetAll}>
            Ulangi dari awal
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// ─── Komponen utama PdfQuestionView ──────────────────────────────────────────

export function PdfQuestionView({
  question,
  answer = {},
  disabled,
  onChange,
  onChooseOption,
  selectedOptionId,
}: {
  question: PdfTakeQuestion;
  answer?: Record<string, unknown>;
  disabled: boolean;
  onChange?: (answer: Record<string, unknown>) => void;
  onChooseOption?: (optionId: string) => void;
  selectedOptionId?: string | null;
}) {
  const config = (question.interactionConfig ?? {}) as Config;
  const overlays = question.pdfOverlays.length > 0 ? question.pdfOverlays : (config.overlays ?? []);

  const [activeLeftId, setActiveLeftId] = React.useState<string | null>(
    config.leftItems?.[0]?.id ?? null,
  );

  const selectedLabel = typeof answer.selectedLabel === "string" ? answer.selectedLabel : null;
  const matches = React.useMemo(
    () => (answer.matches as Record<string, string> | undefined) ?? {},
    [answer.matches],
  );
  const selectedOption = question.options.find((option) => option.id === selectedOptionId);
  const selectedChoiceText = config.choices?.find((choice) => choice.label === selectedLabel)?.text;

  const assignedLabels = React.useMemo(() => {
    const labels: Record<string, string> = {};
    for (const [leftId, rightId] of Object.entries(matches)) {
      const index = (config.rightItems ?? []).findIndex((item) => item.id === rightId);
      if (index >= 0) labels[leftId] = letter(index);
    }
    return labels;
  }, [matches, config.rightItems]);

  const selection = {
    selectedIds:
      question.questionType === "multiple_choice"
        ? overlays
            .filter((overlay) => overlay.kind === "choice" && overlay.label === selectedOption?.label)
            .map((overlay) => overlay.id)
        : question.questionType === "matching"
          ? activeLeftId
            ? [activeLeftId]
            : []
          : question.questionType === "hanzi_blank" && selectedLabel
            ? overlays.map((overlay) => overlay.id)
            : [],
    assignedLabels,
    selectedText: question.questionType === "hanzi_blank" ? selectedChoiceText : undefined,
  };

  function selectOverlay(overlay: PdfOverlay) {
    if (question.questionType === "multiple_choice") {
      const option = question.options.find(
        (item) => item.label.toLowerCase() === (overlay.label ?? overlay.id).toLowerCase(),
      );
      if (option && onChooseOption) onChooseOption(option.id);
      return;
    }
    if (question.questionType === "matching") {
      setActiveLeftId(overlay.id);
    }
  }

  function handleMatchAssign(leftId: string, rightId: string) {
    const next = { ...matches };
    for (const [k, v] of Object.entries(next)) {
      if (v === rightId && k !== leftId) delete next[k];
    }
    next[leftId] = rightId;
    onChange?.({ matches: next });
  }

  function handleMatchClear(leftId: string) {
    if (leftId === "__all__") {
      onChange?.({ matches: {} });
      return;
    }
    const next = { ...matches };
    delete next[leftId];
    onChange?.({ matches: next });
  }

  return (
    <article className="flex flex-col gap-6 rounded-[3px] border border-border bg-surface p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-xs text-text-muted tabular">Soal {question.number}</p>
        <p className="text-xs text-text-muted">
          {question.section === "listening" ? "Listening" : "Reading"}
        </p>
      </header>

      <p className="font-cjk text-question" lang="zh-Hans">
        <PromptText prompt={question.prompt} />
      </p>

      {question.audioPath ? (
        <audio
          key={question.audioPath}
          controls
          preload="none"
          controlsList="nodownload"
          aria-label={`Audio soal ${question.number}`}
          className="w-full"
        >
          <source src={mediaUrl(question.audioPath) ?? ""} />
          Browser Anda tidak mendukung pemutar audio.
        </audio>
      ) : null}

      {question.imagePath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl(question.imagePath) ?? ""}
          alt={`Gambar soal ${question.number}`}
          className="max-h-80 w-auto max-w-full rounded-[2px] border border-border object-contain"
        />
      ) : null}

      {overlays.length > 0 ? (
        question.pdfPath ? (
          <PdfQuestionDocument
            src={mediaUrl(question.pdfPath) ?? ""}
            overlays={overlays}
            selection={selection}
            disabled={disabled}
            onSelect={selectOverlay}
          />
        ) : (
          <Alert tone="warning">
            PDF murid belum tersedia. Hubungi pengajar agar dokumen soal dapat ditampilkan.
          </Alert>
        )
      ) : null}

      {question.questionType === "multiple_choice" ? (
        <div className="flex flex-col gap-2">
          {question.options.map((option) => {
            const selected = selectedOptionId === option.id;
            return (
              <OptionButton
                key={option.id}
                selected={selected}
                disabled={disabled}
                onClick={() => onChooseOption?.(option.id)}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-[2px] border border-border-strong font-mono text-sm",
                    selected ? "border-primary text-primary" : "text-text-muted",
                  )}
                >
                  {option.label}
                </span>
                <span className="font-cjk text-option" lang="zh-Hans">
                  {option.text}
                </span>
              </OptionButton>
            );
          })}
        </div>
      ) : null}

      {question.questionType === "hanzi_blank" ? (
        <HanziBlankView
          config={config}
          answer={answer}
          disabled={disabled}
          onChange={onChange}
        />
      ) : null}

      {question.questionType === "matching" ? (
        <MatchingView
          config={config}
          matches={matches}
          disabled={disabled}
          onAssign={handleMatchAssign}
          onClear={handleMatchClear}
        />
      ) : null}

      {question.questionType === "rearrange_sentence" ? (
        <RearrangeView
          config={config}
          questionId={question.id}
          answer={answer}
          disabled={disabled}
          onChange={onChange}
        />
      ) : null}
    </article>
  );
}
