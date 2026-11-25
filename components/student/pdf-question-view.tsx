"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Eraser } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  PdfQuestionDocument,
  type PdfOverlay,
} from "@/components/student/pdf-page-overlays";
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
  options: { id: string; label: string; text: string }[];
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
  const [order, setOrder] = React.useState<string[]>(() => {
    const saved = answer.order as string[] | undefined;
    return saved ?? (config.tokens ?? []).map((token) => token.id);
  });

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

  function chooseMatch(rightId: string) {
    if (!activeLeftId) return;
    const next = { ...matches, [activeLeftId]: rightId };
    onChange?.({ matches: next });
    const currentIndex = (config.leftItems ?? []).findIndex((item) => item.id === activeLeftId);
    const nextLeft = (config.leftItems ?? [])[currentIndex + 1];
    if (nextLeft) setActiveLeftId(nextLeft.id);
  }

  function moveToken(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    onChange?.({ order: next });
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
        {question.prompt}
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

      {question.pdfPath ? (
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
      )}

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
        <div className="flex flex-col gap-3">
          <p className="text-xs text-text-muted">
            Pilih kata Hanzi untuk setiap bagian kosong pada dokumen.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(config.choices ?? []).map((choice) => {
              const selected = selectedLabel === choice.label;
              return (
                <OptionButton
                  key={choice.label}
                  selected={selected}
                  disabled={disabled}
                  onClick={() => onChange?.({ selectedLabel: choice.label })}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-[2px] border border-border-strong font-mono text-sm",
                      selected ? "border-primary text-primary" : "text-text-muted",
                    )}
                  >
                    {choice.label}
                  </span>
                  <span className="font-cjk text-option" lang="zh-Hans">
                    {choice.text}
                  </span>
                </OptionButton>
              );
            })}
          </div>
          {selectedLabel ? (
            <div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Eraser size={14} strokeWidth={1.5} aria-hidden="true" />}
                onClick={() => onChange?.({})}
                disabled={disabled}
              >
                Kosongkan pilihan
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {question.questionType === "matching" ? (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-text-muted">
            Klik nomor pada dokumen atau daftar, lalu pilih pasangan A–E.
          </p>
          <div className="flex flex-col gap-2">
            {(config.leftItems ?? []).map((item, index) => {
              const assigned = assignedLabels[item.id];
              const active = activeLeftId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveLeftId(item.id)}
                  disabled={disabled}
                  aria-pressed={active}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-3 rounded-[2px] border px-3 py-2 text-left",
                    active
                      ? "border-2 border-primary bg-primary-subtle"
                      : "border-border-strong bg-surface hover:bg-surface-muted",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-xs text-text-muted">{index + 1}.</span>
                    <span className="font-cjk text-sm" lang="zh-Hans">
                      {item.text}
                    </span>
                  </span>
                  <span className="font-mono text-sm font-semibold text-primary">
                    {assigned ?? "—"}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(config.rightItems ?? []).map((item, index) => {
              const used = Object.entries(matches).some(
                ([leftId, rightId]) => leftId !== activeLeftId && rightId === item.id,
              );
              return (
                <OptionButton
                  key={item.id}
                  selected={Boolean(activeLeftId && matches[activeLeftId] === item.id)}
                  disabled={disabled || used}
                  onClick={() => chooseMatch(item.id)}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-[2px] border border-border-strong font-mono text-sm text-text-muted">
                    {letter(index)}
                  </span>
                  <span className="font-cjk text-option" lang="zh-Hans">
                    {item.text}
                  </span>
                </OptionButton>
              );
            })}
          </div>
        </div>
      ) : null}

      {question.questionType === "rearrange_sentence" ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-text-muted">
            Susun potongan menjadi kalimat yang benar dengan tombol naik/turun.
          </p>
          {order.map((tokenId, index) => {
            const token = (config.tokens ?? []).find((item) => item.id === tokenId);
            if (!token) return null;
            return (
              <div
                key={token.id}
                className="flex min-h-12 items-center gap-2 border border-border-strong bg-surface px-3 py-2"
              >
                <span className="font-mono text-xs text-text-muted">{index + 1}</span>
                <span className="flex-1 font-cjk text-option" lang="zh-Hans">
                  {token.text}
                </span>
                <button
                  type="button"
                  onClick={() => moveToken(index, -1)}
                  disabled={disabled || index === 0}
                  aria-label={`Naikkan potongan ${index + 1}`}
                  className="rounded-sm border border-border p-1 text-text hover:bg-surface-muted disabled:opacity-40"
                >
                  <ArrowUp size={14} strokeWidth={1.5} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => moveToken(index, 1)}
                  disabled={disabled || index === order.length - 1}
                  aria-label={`Turunkan potongan ${index + 1}`}
                  className="rounded-sm border border-border p-1 text-text hover:bg-surface-muted disabled:opacity-40"
                >
                  <ArrowDown size={14} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}
