"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { QuestionView } from "@/components/student/question-view";
import {
  saveAnswerAction,
  submitAttemptAction,
} from "@/app/(student)/tests/actions";

export type TakeQuestion = {
  id: string;
  number: number;
  section: "listening" | "reading";
  prompt: string;
  imagePath: string | null;
  audioPath: string | null;
  options: { id: string; label: string; text: string }[];
};

type SaveState = "saving" | "saved" | "error";

const BACKOFF_MS = [1000, 3000, 6000];
const LETTERS = ["A", "B", "C", "D", "E"] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function mediaUrl(path: string | null): string | null {
  if (!path) return null;
  return `/api/media?path=${encodeURIComponent(path)}`;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function Watermark({ name }: { name: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 select-none overflow-hidden"
    >
      <div className="grid h-full w-full grid-cols-2 gap-16 p-6 text-xs text-[rgba(26,26,26,0.06)] sm:grid-cols-3">
        {Array.from({ length: 18 }).map((_, index) => (
          <span key={index} className="-rotate-[30deg] whitespace-nowrap">
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TakeClient({
  attemptId,
  testId,
  testTitle,
  expiresAt,
  serverNow,
  questions,
  initialAnswers,
  studentName,
}: {
  attemptId: string;
  testId: string;
  testTitle: string;
  expiresAt: string;
  serverNow: string;
  questions: TakeQuestion[];
  initialAnswers: Record<string, string>;
  studentName: string;
}) {
  const router = useRouter();
  const expiresMs = React.useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const serverNowMs = React.useMemo(
    () => new Date(serverNow).getTime(),
    [serverNow],
  );
  // Waktu berjalan memakai performance.now() (monoton), bukan jam perangkat.
  const perfStartRef = React.useRef(0);

  const [nowMs, setNowMs] = React.useState(() =>
    Math.max(0, new Date(serverNow).getTime()),
  );

  React.useEffect(() => {
    perfStartRef.current = performance.now();
  }, [serverNow]);
  const [answers, setAnswers] =
    React.useState<Record<string, string>>(initialAnswers);
  const answersRef = React.useRef(answers);
  const [saveState, setSaveState] = React.useState<Record<string, SaveState>>({});
  // Antrean per soal: pilihan terbaru selalu disimpan setelah pilihan sebelumnya,
  // sehingga respons lama tidak bisa menimpa jawaban yang lebih baru.
  const saveQueueRef = React.useRef<Record<string, Promise<void>>>({});
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [navOpen, setNavOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [announcement, setAnnouncement] = React.useState("");
  const submittedRef = React.useRef(false);
  const announcedRef = React.useRef({ five: false, one: false });

  React.useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const submit = React.useCallback(
    async () => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      setError(null);

      // Tunggu autosave yang masih berjalan agar jawaban terakhir ikut dinilai.
      await Promise.allSettled(Object.values(saveQueueRef.current));

      let result: Awaited<ReturnType<typeof submitAttemptAction>>;
      try {
        result = await submitAttemptAction(attemptId);
      } catch {
        result = {
          ok: false,
          error: "Gagal mengumpulkan. Periksa koneksi, lalu coba lagi.",
        };
      }

      if (!result.ok) {
        submittedRef.current = false;
        setSubmitting(false);
        setError(result.error);
        return;
      }

      router.replace(`/tests/${testId}/done`);
    },
    [attemptId, router, testId],
  );

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      const value = serverNowMs + (performance.now() - perfStartRef.current);
      setNowMs(value);
      const remaining = expiresMs - value;

      if (remaining <= 300000 && remaining > 0 && !announcedRef.current.five) {
        announcedRef.current.five = true;
        setAnnouncement("Waktu tersisa 5 menit.");
      }
      if (remaining <= 60000 && remaining > 0 && !announcedRef.current.one) {
        announcedRef.current.one = true;
        setAnnouncement("Waktu tersisa 1 menit.");
      }
      if (remaining <= 0) {
        void submit();
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [expiresMs, serverNowMs, submit]);

  const unsaved = Object.entries(saveState).some(
    ([questionId, state]) => state !== "saved" && Boolean(answers[questionId]),
  );
  const unsavedRef = React.useRef(unsaved);
  React.useEffect(() => {
    unsavedRef.current = unsaved;
  }, [unsaved]);

  React.useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!unsavedRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const current = questions[currentIndex];
  const answeredCount = questions.filter((question) => answers[question.id]).length;
  const unanswered = questions.length - answeredCount;
  const remainingMs = Math.max(0, expiresMs - nowMs);
  const lowTime = remainingMs <= 5 * 60 * 1000;

  async function persist(questionId: string, optionId: string) {
    setSaveState((state) => ({ ...state, [questionId]: "saving" }));

    for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt += 1) {
      if (attempt > 0) await sleep(BACKOFF_MS[attempt - 1]);
      if (answersRef.current[questionId] !== optionId) return;

      let ok = false;
      try {
        const result = await saveAnswerAction(attemptId, questionId, optionId);
        ok = result.ok;
      } catch {
        ok = false;
      }

      if (ok) {
        if (answersRef.current[questionId] === optionId) {
          setSaveState((state) => ({ ...state, [questionId]: "saved" }));
        }
        return;
      }

      if (attempt === BACKOFF_MS.length) {
        if (answersRef.current[questionId] === optionId) {
          setSaveState((state) => ({ ...state, [questionId]: "error" }));
        }
      }
    }
  }

  function enqueuePersist(questionId: string, optionId: string) {
    const previous = saveQueueRef.current[questionId] ?? Promise.resolve();
    saveQueueRef.current[questionId] = previous
      .catch(() => undefined)
      .then(() => persist(questionId, optionId));
  }

  function chooseOption(optionId: string) {
    if (!current) return;
    setAnswers((state) => ({ ...state, [current.id]: optionId }));
    enqueuePersist(current.id, optionId);
  }

  function retryCurrent() {
    if (!current) return;
    const optionId = answers[current.id];
    if (optionId) enqueuePersist(current.id, optionId);
  }

  function goTo(index: number) {
    if (index < 0 || index >= questions.length) return;
    setCurrentIndex(index);
    setNavOpen(false);
  }

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (navOpen || confirmOpen || submitting) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setCurrentIndex((index) => Math.max(0, index - 1));
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setCurrentIndex((index) => Math.min(questions.length - 1, index + 1));
        return;
      }

      const letter = event.key.toUpperCase();
      const letterIndex = LETTERS.indexOf(letter as (typeof LETTERS)[number]);
      if (letterIndex >= 0 && current) {
        const option = current.options[letterIndex];
        if (option) {
          event.preventDefault();
          chooseOption(option.id);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!current) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-8">
        <Alert tone="error">
          Tes ini belum memiliki soal. Hubungi pengajar.
        </Alert>
      </div>
    );
  }

  const currentSaveState = saveState[current.id];

  const saveLabel =
    currentSaveState === "saving"
      ? "Menyimpan..."
      : currentSaveState === "error"
        ? "Belum tersimpan"
        : currentSaveState === "saved"
          ? "Tersimpan"
          : "";

  const navGrid = (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-6">
      {questions.map((question, index) => {
        const answered = Boolean(answers[question.id]);
        const active = index === currentIndex;
        const failed = saveState[question.id] === "error";
        return (
          <button
            key={question.id}
            type="button"
            onClick={() => goTo(index)}
            aria-label={`Soal ${question.number}${answered ? ", terjawab" : ", belum dijawab"}`}
            aria-current={active ? "true" : undefined}
            className={[
              "flex size-10 items-center justify-center rounded-sm border font-mono text-sm tabular transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              answered
                ? "border-primary bg-primary-subtle text-primary"
                : "border-border-strong bg-surface text-text",
              active ? "outline-2 outline-offset-2 outline-primary" : "",
              failed ? "border-accent text-accent" : "",
            ].join(" ")}
          >
            {question.number}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-bg">
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
          <h1 className="truncate text-sm font-semibold text-text">
            {testTitle}
          </h1>
          <div className="hidden text-xs text-text-muted sm:block">
            {answeredCount} dari {questions.length} terjawab
          </div>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={`font-mono text-timer font-medium tabular ${
                lowTime ? "text-accent" : "text-text"
              }`}
            >
              {formatRemaining(remainingMs)}
            </span>
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="rounded-sm border border-border-strong p-2 text-text hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:hidden"
              aria-label="Daftar soal"
            >
              <ListChecks size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-text-muted sm:hidden">
          <span>
            {answeredCount} dari {questions.length} terjawab
          </span>
          <span>Soal {current.number}</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6">
        {error && !confirmOpen ? (
          <div className="pb-4">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex max-w-[720px] flex-col gap-4">
            <div className="flex min-h-5 items-center justify-between gap-3 text-xs">
              <span className="text-text-muted">
                Soal {current.number} dari {questions.length}
              </span>
              <span className="flex items-center gap-2">
                <span
                  aria-live="polite"
                  className={
                    currentSaveState === "error"
                      ? "text-accent"
                      : "text-text-muted"
                  }
                >
                  {saveLabel}
                </span>
                {currentSaveState === "error" ? (
                  <button
                    type="button"
                    onClick={retryCurrent}
                    className="text-primary underline underline-offset-2"
                  >
                    Coba lagi
                  </button>
                ) : null}
              </span>
            </div>

            <div className="relative select-none">
              <Watermark name={studentName} />
              <div className="relative z-0">
                <QuestionView
                  question={{
                    number: current.number,
                    section: current.section,
                    prompt: current.prompt,
                    imageUrl: mediaUrl(current.imagePath),
                    audioUrl: mediaUrl(current.audioPath),
                    options: current.options,
                  }}
                  selectedOptionId={answers[current.id] ?? null}
                  onSelect={chooseOption}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => goTo(currentIndex - 1)}
                disabled={currentIndex === 0}
                icon={
                  <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
                }
              >
                Sebelumnya
              </Button>
              <Button
                onClick={() => goTo(currentIndex + 1)}
                disabled={currentIndex === questions.length - 1}
              >
                Berikutnya
                <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
              </Button>
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-20 flex flex-col gap-4 rounded-md border border-border bg-surface p-4">
              <p className="text-xs font-medium text-text">Daftar soal</p>
              <p className="text-xs text-text-muted">
                {answeredCount} dari {questions.length} terjawab
              </p>
              {navGrid}
              <Button onClick={() => setConfirmOpen(true)}>Kumpulkan</Button>
            </div>
          </aside>
        </div>
      </main>

      <Dialog
        open={navOpen}
        onClose={() => setNavOpen(false)}
        title="Daftar soal"
        description={`${answeredCount} dari ${questions.length} terjawab`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setNavOpen(false)}>
              Tutup
            </Button>
            <Button
              onClick={() => {
                setNavOpen(false);
                setConfirmOpen(true);
              }}
            >
              Kumpulkan
            </Button>
          </>
        }
      >
        {navGrid}
      </Dialog>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Kumpulkan jawaban?"
        description="Jawaban tidak dapat diubah setelah dikumpulkan."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button onClick={() => void submit()} loading={submitting}>
              Kumpulkan
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {unanswered > 0 ? (
            <Alert tone="warning">
              Masih ada {unanswered} soal yang belum dijawab. Soal kosong
              dihitung salah.
            </Alert>
          ) : (
            <p className="text-sm text-text">
              Semua {questions.length} soal sudah dijawab.
            </p>
          )}
          {error ? <Alert tone="error">{error}</Alert> : null}
        </div>
      </Dialog>
    </div>
  );
}
