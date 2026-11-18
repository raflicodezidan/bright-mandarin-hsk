"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  deleteQuestionAction,
  saveQuestionAction,
  updateQuestionTextAction,
} from "@/app/admin/tests/actions";
import type { Tables } from "@/lib/supabase/database.types";

type Section = Tables<"questions">["section"];
type OptionDraft = { key: string; text: string };

let optionCounter = 0;
function newOption(text = ""): OptionDraft {
  optionCounter += 1;
  return { key: `opt-${optionCounter}`, text };
}

const LABELS = ["A", "B", "C", "D", "E"] as const;

export type QuestionFormInitial = {
  section: Section;
  prompt: string;
  options: { label: string; text: string }[];
  correctLabel: string;
};

export function QuestionForm({
  testId,
  questionId,
  initial,
  existingImage,
  existingAudio,
  imageUrl,
  audioUrl,
  locked = false,
  textOnly = false,
}: {
  testId: string;
  questionId: string;
  initial?: QuestionFormInitial;
  existingImage: string | null;
  existingAudio: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  locked?: boolean;
  textOnly?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [section, setSection] = React.useState<Section>(
    initial?.section ?? "listening",
  );
  const [prompt, setPrompt] = React.useState(initial?.prompt ?? "");
  const [options, setOptions] = React.useState<OptionDraft[]>(
    initial && initial.options.length >= 2
      ? initial.options.map((option) => newOption(option.text))
      : [newOption(), newOption()],
  );
  const [correctIndex, setCorrectIndex] = React.useState(() => {
    if (!initial) return 0;
    const index = initial.options.findIndex(
      (option) => option.label === initial.correctLabel,
    );
    return index >= 0 ? index : 0;
  });
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [audioFile, setAudioFile] = React.useState<File | null>(null);
  const [removeImage, setRemoveImage] = React.useState(false);
  const [removeAudio, setRemoveAudio] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const hasAudio = Boolean(audioFile) || (Boolean(existingAudio) && !removeAudio);

  function updateOption(key: string, text: string) {
    setOptions((current) =>
      current.map((option) => (option.key === key ? { ...option, text } : option)),
    );
  }

  function addOption() {
    setOptions((current) =>
      current.length >= 5 ? current : [...current, newOption()],
    );
  }

  function removeOption(index: number) {
    setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setCorrectIndex((current) => {
      if (current === index) return 0;
      if (current > index) return current - 1;
      return current;
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (textOnly) {
      const payload = new FormData();
      payload.set("testId", testId);
      payload.set("questionId", questionId);
      payload.set("prompt", prompt);
      payload.set("options", JSON.stringify(options.map((option, index) => ({
        label: LABELS[index],
        text: option.text.trim(),
      }))));
      payload.set("correctLabel", LABELS[correctIndex]);
      startTransition(async () => {
        const result = await updateQuestionTextAction(payload);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast("Teks soal, opsi, dan kunci diperbarui. Nilai dihitung ulang.");
        router.push(`/admin/tests/${testId}`);
        router.refresh();
      });
      return;
    }

    if (options.length < 2 || options.length > 5) {
      setError("Soal harus memiliki 2 sampai 5 opsi.");
      return;
    }
    if (options.some((option) => option.text.trim() === "")) {
      setError("Semua opsi wajib diisi.");
      return;
    }
    if (section === "listening" && !hasAudio) {
      setError("Soal Listening wajib memiliki audio mp3.");
      return;
    }
    if (imageFile && imageFile.size > 2 * 1024 * 1024) {
      setError("Ukuran gambar maksimal 2 MB.");
      return;
    }
    if (audioFile && audioFile.size > 10 * 1024 * 1024) {
      setError("Ukuran audio maksimal 10 MB.");
      return;
    }

    const payload = new FormData();
    payload.set("testId", testId);
    payload.set("questionId", questionId);
    payload.set("section", section);
    payload.set("prompt", prompt);
    payload.set(
      "options",
      JSON.stringify(
        options.map((option, index) => ({
          label: LABELS[index],
          text: option.text.trim(),
        })),
      ),
    );
    payload.set("correctLabel", LABELS[correctIndex]);
    payload.set("existingImage", existingImage ?? "");
    payload.set("existingAudio", existingAudio ?? "");
    if (removeImage) payload.set("removeImage", "on");
    if (removeAudio) payload.set("removeAudio", "on");
    if (imageFile) payload.set("image", imageFile);
    if (audioFile) payload.set("audio", audioFile);

    startTransition(async () => {
      const result = await saveQuestionAction(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast(questionId === "new" ? "Soal ditambahkan." : "Soal disimpan.");
      router.push(`/admin/tests/${testId}`);
      router.refresh();
    });
  }

  function removeQuestion() {
    setError(null);
    startTransition(async () => {
      const result = await deleteQuestionAction(questionId);
      if (!result.ok) {
        setError(result.error);
        setConfirmDelete(false);
        return;
      }
      toast("Soal dihapus.");
      setConfirmDelete(false);
      router.push(`/admin/tests/${testId}`);
      router.refresh();
    });
  }

  if (locked) {
    return (
      <Card>
        <Alert tone="warning" title="Soal terkunci">
          Tes ini sudah memiliki pengerjaan sehingga soal, opsi, dan kunci tidak
          dapat diubah.
        </Alert>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="flex max-w-[640px] flex-col gap-4">
        {error ? <Alert tone="error">{error}</Alert> : null}

        {textOnly ? (
          <Alert tone="warning" title="Pengeditan soal setelah pengerjaan">
            Teks soal, teks opsi, dan kunci jawaban dapat diubah. Nilai pengerjaan
            yang sudah selesai dihitung ulang dengan kunci terbaru. Bagian,
            urutan, jumlah opsi, media, dan durasi tetap terkunci.
          </Alert>
        ) : null}

        <Field label="Bagian" htmlFor="question-section" required>
          <Select
            id="question-section"
            value={section}
            onChange={(event) => setSection(event.target.value as Section)}
            disabled={pending || textOnly}
          >
            <option value="listening">Listening</option>
            <option value="reading">Reading</option>
          </Select>
        </Field>

        <Field
          label="Teks soal"
          htmlFor="question-prompt"
          hint="Mendukung karakter Mandarin."
          required
        >
          <Textarea
            id="question-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="font-cjk min-h-32 text-base"
            lang="zh-Hans"
            maxLength={4000}
            required
            disabled={pending}
          />
        </Field>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-xs font-medium text-text">
            Opsi jawaban
            <span aria-hidden="true" className="ml-1 text-accent">
              *
            </span>
          </legend>
          {options.map((option, index) => (
            <div key={option.key} className="flex items-start gap-2">
              <label className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-sm border border-border-strong font-mono text-xs">
                {LABELS[index]}
              </label>
              <Input
                value={option.text}
                onChange={(event) => updateOption(option.key, event.target.value)}
                className="font-cjk"
                lang="zh-Hans"
                maxLength={2000}
                aria-label={`Teks opsi ${LABELS[index]}`}
                required
                disabled={pending}
              />
            {!textOnly ? (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1"
                aria-label={`Hapus opsi ${LABELS[index]}`}
                onClick={() => removeOption(index)}
                disabled={pending || options.length <= 2}
                icon={<Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />}
              >
                <span className="sr-only">Hapus</span>
              </Button>
            ) : null}
            </div>
          ))}
          {options.length < 5 && !textOnly ? (
            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={addOption}
                disabled={pending}
                icon={<Plus size={14} strokeWidth={1.5} aria-hidden="true" />}
              >
                Tambah opsi
              </Button>
            </div>
          ) : null}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-medium text-text">
            Kunci jawaban
            <span aria-hidden="true" className="ml-1 text-accent">
              *
            </span>
          </legend>
          <div className="flex flex-wrap gap-4">
            {options.map((option, index) => (
              <label
                key={option.key}
                className="flex items-center gap-2 text-sm text-text"
              >
                <input
                  type="radio"
                  name="correct-label"
                  value={LABELS[index]}
                  checked={correctIndex === index}
                  onChange={() => setCorrectIndex(index)}
                  disabled={pending || textOnly}
                  className="size-4 accent-[var(--color-primary)]"
                />
                {LABELS[index]}
              </label>
            ))}
          </div>
        </fieldset>

        <Field
          label="Audio"
          htmlFor="question-audio"
          hint={
            section === "listening"
              ? "Wajib untuk Listening. mp3, maksimal 10 MB."
              : "Opsional. mp3, maksimal 10 MB."
          }
          required={section === "listening"}
        >
          <div className="flex flex-col gap-2">
            {existingAudio && !removeAudio ? (
              <div className="flex flex-col gap-2 rounded-sm border border-border bg-surface-muted p-3">
                <p className="text-xs text-text-muted">
                  Audio saat ini: {existingAudio.split("/").pop()}
                </p>
                {audioUrl ? (
                  <audio
                    controls
                    preload="none"
                    controlsList="nodownload"
                    className="w-full"
                  >
                    <source src={audioUrl} />
                  </audio>
                ) : null}
                <div>
                  {!textOnly ? <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setRemoveAudio(true)}
                disabled={pending}
                  >
                    Hapus audio
                  </Button> : null}
                </div>
              </div>
            ) : null}
            {removeAudio ? (
              <p className="text-xs text-accent">
                Audio akan dihapus saat disimpan.
              </p>
            ) : null}
            <div className="rounded-sm border border-border-strong bg-surface px-3 py-2">
              <input
                id="question-audio"
                type="file"
                accept="audio/mpeg,.mp3"
                onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
                disabled={pending}
                className="block w-full text-sm text-text file:mr-3 file:rounded-sm file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-primary-hover disabled:file:opacity-60"
              />
            </div>
          </div>
        </Field>

        <Field
          label="Gambar"
          htmlFor="question-image"
          hint="Opsional. jpg, png, atau webp, maksimal 2 MB."
        >
          <div className="flex flex-col gap-2">
            {existingImage && !removeImage ? (
              <div className="flex flex-col gap-2 rounded-sm border border-border bg-surface-muted p-3">
                <p className="text-xs text-text-muted">
                  Gambar saat ini: {existingImage.split("/").pop()}
                </p>
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt="Pratinjau gambar soal"
                    className="max-h-48 w-auto rounded-sm border border-border object-contain"
                  />
                ) : null}
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setRemoveImage(true)}
                    disabled={pending || textOnly}
                  >
                    Hapus gambar
                  </Button>
                </div>
              </div>
            ) : null}
            {removeImage ? (
              <p className="text-xs text-accent">
                Gambar akan dihapus saat disimpan.
              </p>
            ) : null}
            <div className="rounded-sm border border-border-strong bg-surface px-3 py-2">
              <input
                id="question-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                disabled={pending || textOnly}
                className="block w-full text-sm text-text file:mr-3 file:rounded-sm file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-primary-hover disabled:file:opacity-60"
              />
            </div>
          </div>
        </Field>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button type="submit" loading={pending}>
            Simpan soal
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push(`/admin/tests/${testId}`)}
            disabled={pending}
          >
            Batal
          </Button>
          {questionId !== "new" && !locked && !textOnly ? (
            <Button
              variant="danger"
              onClick={() => setConfirmDelete(true)}
              disabled={pending}
            >
              Hapus soal
            </Button>
          ) : null}
        </div>
      </form>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Hapus soal?"
        description="Soal beserta opsi, kunci, dan medianya akan dihapus permanen."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmDelete(false)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button variant="danger" onClick={removeQuestion} loading={pending}>
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-muted">
          Nomor soal setelahnya akan dirapikan otomatis.
        </p>
      </Dialog>
    </Card>
  );
}
