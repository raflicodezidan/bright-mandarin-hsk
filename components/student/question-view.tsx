import { cn } from "@/lib/utils";

export type QuestionViewOption = {
  id: string;
  label: string;
  text: string;
};

export type QuestionViewData = {
  number: number;
  section: "listening" | "reading";
  prompt: string;
  imageUrl: string | null;
  audioUrl: string | null;
  options: QuestionViewOption[];
};

export function QuestionView({
  question,
  selectedOptionId,
  onSelect,
  disabled = false,
}: {
  question: QuestionViewData;
  selectedOptionId?: string | null;
  onSelect?: (optionId: string) => void;
  disabled?: boolean;
}) {
  const sectionLabel = question.section === "listening" ? "Listening" : "Reading";

  return (
    <article className="flex flex-col gap-6 rounded-[3px] border border-border bg-surface p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-xs text-text-muted tabular">
          Soal {question.number}
        </p>
        <p className="text-xs text-text-muted">{sectionLabel}</p>
      </header>

      <p className="font-cjk text-question" lang="zh-Hans">
        {question.prompt}
      </p>

      {question.audioUrl ? (
        <audio
          key={question.audioUrl}
          controls
          preload="none"
          controlsList="nodownload"
          aria-label={`Audio soal ${question.number}`}
          className="w-full"
        >
          <source src={question.audioUrl} />
          Browser Anda tidak mendukung pemutar audio.
        </audio>
      ) : null}

      {question.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={question.imageUrl}
          alt={`Gambar soal ${question.number}`}
          className="max-h-80 w-auto max-w-full rounded-[2px] border border-border object-contain"
        />
      ) : null}

      <div className="flex flex-col gap-2">
        {question.options.map((option) => {
          const selected = selectedOptionId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={onSelect ? () => onSelect(option.id) : undefined}
              disabled={disabled || !onSelect}
              aria-pressed={selected}
              className={cn(
                "flex min-h-14 w-full items-center gap-3 rounded-[2px] border px-3 py-2 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:min-h-12",
                selected
                  ? "border-2 border-primary bg-primary-subtle"
                  : "border-border-strong bg-surface hover:bg-surface-muted",
                (disabled || !onSelect) && "cursor-default",
              )}
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
            </button>
          );
        })}
      </div>
    </article>
  );
}
