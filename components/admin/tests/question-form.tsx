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
  saveInteractiveQuestionAction,
  updateInteractiveQuestionTextOnlyAction,
  updateInteractiveQuestionAction,
  saveQuestionAction,
  updateQuestionTextAction,
} from "@/app/admin/tests/actions";
import type { Tables } from "@/lib/supabase/database.types";
import type { Json } from "@/lib/supabase/database.types";

type Section = Tables<"questions">["section"];
type OptionDraft = { key: string; text: string; imageFile: File | null; imagePath: string | null; imageUrl: string | null };

let optionCounter = 0;
function newOption(text = ""): OptionDraft {
  optionCounter += 1;
  return { key: `opt-${optionCounter}`, text, imageFile: null, imagePath: null, imageUrl: null };
}

const LABELS = ["A", "B", "C", "D", "E"] as const;

export type QuestionFormInitial = {
  section: Section;
  prompt: string;
  options: { label: string; text: string; imagePath?: string | null; imageUrl?: string | null }[];
  correctLabel: string;
  questionType?: "multiple_choice" | "matching" | "hanzi_blank" | "rearrange_sentence";
  interactionConfig?: Json;
  interactionAnswer?: Json;
};

export function QuestionForm({
  testId,
  questionId,
  initial,
  existingImage,
  existingAudio,
  imageUrl,
  audioUrl,
  sharedListeningAudioUrl,
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
  sharedListeningAudioUrl?: string | null;
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
      ? initial.options.map((option) => ({ ...newOption(option.text ?? ""), imagePath: option.imagePath ?? null, imageUrl: option.imageUrl ?? null }))
      : [newOption(), newOption()],
  );
  const [correctIndex, setCorrectIndex] = React.useState<number | null>(() => {
    if (!initial) return 0;
    const index = initial.options.findIndex(
      (option) => option.label === initial.correctLabel,
    );
    return index >= 0 ? index : null;
  });
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [audioFile, setAudioFile] = React.useState<File | null>(null);
  const optionImageInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const [removeImage, setRemoveImage] = React.useState(false);
  const [removeAudio, setRemoveAudio] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [questionType, setQuestionType] = React.useState<QuestionFormInitial["questionType"]>(initial?.questionType ?? "multiple_choice");
  const [leftItems, setLeftItems] = React.useState<{ id: string; text: string }[]>(() => {
    const config = initial?.interactionConfig as { leftItems?: { id: string; text: string }[] } | undefined;
    return config?.leftItems ?? [{ id: "left-1", text: "" }, { id: "left-2", text: "" }];
  });
  const [rightItems, setRightItems] = React.useState<{ id: string; text: string }[]>(() => {
    const config = initial?.interactionConfig as { rightItems?: { id: string; text: string }[] } | undefined;
    return config?.rightItems ?? [{ id: "right-1", text: "" }, { id: "right-2", text: "" }];
  });
  const [matchingKeys, setMatchingKeys] = React.useState<Record<string, string>>(() => {
    const key = initial?.interactionAnswer as { matches?: Record<string, string> } | undefined;
    return key?.matches ?? {};
  });
  const [interactionChoices, setInteractionChoices] = React.useState<{ label: string; text: string }[]>(() => {
    const config = initial?.interactionConfig as { choices?: { label: string; text: string }[] } | undefined;
    return config?.choices ?? [{ label: "A", text: "" }, { label: "B", text: "" }];
  });
  const [blankCorrect, setBlankCorrect] = React.useState(() => {
    const key = initial?.interactionAnswer as { correctLabel?: string } | undefined;
    return key?.correctLabel ?? "A";
  });
  const [tokens, setTokens] = React.useState<{ id: string; text: string }[]>(() => {
    const config = initial?.interactionConfig as { tokens?: { id: string; text: string }[] } | undefined;
    return config?.tokens ?? [{ id: "token-1", text: "" }, { id: "token-2", text: "" }];
  });
  const [tokenOrder, setTokenOrder] = React.useState<string[]>(() => {
    const key = initial?.interactionAnswer as { order?: string[] } | undefined;
    return key?.order ?? tokens.map((token) => token.id);
  });

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
      if (current === null) return current;
      if (current === index) return 0;
      if (current > index) return current - 1;
      return current;
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (questionType !== "multiple_choice") {
      const config = questionType === "matching"
        ? { leftItems, rightItems }
        : questionType === "hanzi_blank"
          ? { choices: interactionChoices, blankCount: 1 }
          : { tokens };
      const answerKey = questionType === "matching"
        ? { matches: matchingKeys }
        : questionType === "hanzi_blank"
          ? { correctLabel: blankCorrect }
          : { order: tokenOrder };
      startTransition(async () => {
        const matchingConfig = questionType === "matching" ? {
          leftItems,
          rightItems: rightItems.map((item) => ({ id: item.id, text: item.text })),
        } : config;
        const matchingAnswerKey = questionType === "matching"
          ? { matches: matchingKeys }
          : answerKey;
        const action = textOnly
          ? updateInteractiveQuestionTextOnlyAction
          : questionId === "new"
            ? saveInteractiveQuestionAction
            : updateInteractiveQuestionAction;
        const result = await action({
          testId,
          ...(questionId === "new" ? {} : { questionId }),
          type: questionType,
          section,
          prompt,
          config: matchingConfig,
          answerKey: matchingAnswerKey,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast("Soal interaktif disimpan.");
        router.push(`/admin/tests/${testId}`);
        router.refresh();
      });
      return;
    }

    if (correctIndex === null) {
      setError("Pilih kunci jawaban sebelum menyimpan.");
      return;
    }

    if (questionId !== "new") {
      setError("Untuk mengganti tipe soal yang sudah ada, buat soal baru. Tipe soal lama tidak diubah agar riwayat jawaban tetap konsisten.");
      return;
    }

    if (textOnly) {
      const payload = new FormData();
      payload.set("testId", testId);
      payload.set("questionId", questionId);
      payload.set("prompt", prompt);
      payload.set("options", JSON.stringify(options.map((option, index) => ({
        label: LABELS[index],
        text: option.text.trim(),
        imagePath: option.imagePath,
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
    if (options.some((option) => option.text.trim() === "" && !option.imageFile && !option.imagePath)) {
      setError("Setiap opsi perlu berisi teks atau gambar.");
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
    if (audioFile && audioFile.size < 1) {
      setError("File audio kosong atau tidak valid.");
      return;
    }

    const payload = new FormData();
    payload.set("testId", testId);
    payload.set("questionId", questionId);
    payload.set("section", section);
    payload.set("prompt", prompt);
    payload.set(
      "options",
      JSON.stringify(options.map((option, index) => ({
        label: LABELS[index],
        text: option.text.trim(),
        imagePath: option.imagePath,
      }))),
    );
    payload.set("correctLabel", LABELS[correctIndex]);
    payload.set("existingImage", existingImage ?? "");
    payload.set("existingAudio", existingAudio ?? "");
    if (removeImage) payload.set("removeImage", "on");
    if (removeAudio) payload.set("removeAudio", "on");
    if (imageFile) payload.set("image", imageFile);
    if (audioFile) payload.set("audio", audioFile);
    options.forEach((option, index) => {
      if (option.imageFile) payload.set(`optionImage:${LABELS[index]}`, option.imageFile);
    });

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

        <Field label="Tipe soal" htmlFor="question-type" required>
          <Select
            id="question-type"
            value={questionType}
            onChange={(event) => setQuestionType(event.target.value as QuestionFormInitial["questionType"])}
            disabled={pending || textOnly || questionId !== "new"}
          >
            <option value="multiple_choice">Pilihan ganda</option>
            <option value="matching">Matching / memasangkan</option>
            <option value="hanzi_blank">Isian Hanzi dengan opsi</option>
            <option value="rearrange_sentence">Susun ulang kalimat</option>
          </Select>
        </Field>

        <Field label="Bagian" htmlFor="question-section" required>
          <Select
            id="question-section"
            value={section}
            onChange={(event) => setSection(event.target.value as Section)}
            disabled={pending || textOnly || questionId !== "new"}
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

        {questionType === "matching" ? (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-text-muted">Pasangkan setiap item kiri dengan item kanan. Kunci disimpan hanya di server.</p>
            {[{ title: "Kolom kiri", items: leftItems, set: setLeftItems }, { title: "Kolom kanan", items: rightItems, set: setRightItems }].map(({ title, items, set }) => (
              <fieldset key={title} className="flex flex-col gap-2">
                <legend className="text-xs font-medium">{title}</legend>
                {items.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <span className="w-7 font-mono text-xs">{index + 1}</span>
                    <Input className="font-cjk" value={item.text} lang="zh-Hans" maxLength={300} aria-label={`${title} item ${index + 1}`} onChange={(event) => set(items.map((row) => row.id === item.id ? { ...row, text: event.target.value } : row))} disabled={pending || textOnly} />
                    {!textOnly && index > 1 ? <Button type="button" size="sm" variant="ghost" onClick={() => set(items.filter((row) => row.id !== item.id))} disabled={pending}>Hapus</Button> : null}
                  </div>
                ))}
                {!textOnly && items.length < 10 ? <Button type="button" size="sm" variant="secondary" onClick={() => set([...items, { id: `${title === "Kolom kiri" ? "left" : "right"}-${crypto.randomUUID()}`, text: "" }])} disabled={pending}>Tambah item</Button> : null}
              </fieldset>
            ))}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-medium">Kunci pasangan</legend>
              {leftItems.map((item, index) => <Field key={item.id} label={item.text || `Item kiri ${index + 1}`} htmlFor={`match-key-${item.id}`}><Select id={`match-key-${item.id}`} value={matchingKeys[item.id] ?? ""} onChange={(event) => setMatchingKeys({ ...matchingKeys, [item.id]: event.target.value })} disabled={pending || textOnly}><option value="">Pilih pasangan</option>{rightItems.map((right, rightIndex) => <option key={right.id} value={right.id}>{right.text || `Item kanan ${rightIndex + 1}`}</option>)}</Select></Field>)}
            </fieldset>
          </div>
        ) : questionType === "hanzi_blank" ? (
          <div className="flex flex-col gap-3">
            <Alert tone="info">Tuliskan soal dengan penanda <code>{"{{blank}}"}</code> pada bagian kosong. Murid memilih satu opsi Hanzi; simplified dan traditional didukung.</Alert>
            <fieldset className="flex flex-col gap-2"><legend className="text-xs font-medium">Opsi dan kunci</legend>{interactionChoices.map((option, index) => <div key={option.label} className="flex items-center gap-2"><span className="w-6 font-mono text-xs">{option.label}</span><Input className="font-cjk" lang="zh-Hans" value={option.text} onChange={(event) => setInteractionChoices(interactionChoices.map((row, i) => i === index ? { ...row, text: event.target.value } : row))} disabled={pending || textOnly} aria-label={`Opsi Hanzi ${option.label}`} /> <label className="flex items-center gap-1 text-xs"><input type="radio" name="hanzi-key" checked={blankCorrect === option.label} onChange={() => setBlankCorrect(option.label)} disabled={pending || textOnly} />Kunci</label></div>)}{!textOnly && interactionChoices.length < 5 ? <Button type="button" size="sm" variant="secondary" onClick={() => setInteractionChoices([...interactionChoices, { label: LABELS[interactionChoices.length], text: "" }])}>Tambah opsi</Button> : null}</fieldset>
          </div>
        ) : questionType === "rearrange_sentence" ? (
          <div className="flex flex-col gap-3">
            <Alert tone="info">Masukkan setiap potongan kalimat, lalu seret ke urutan yang benar. Urutan ini menjadi kunci yang dinilai server.</Alert>
            <div className="flex flex-col gap-2">{tokens.map((token, index) => <div key={token.id} draggable={!textOnly} onDragStart={(event) => event.dataTransfer.setData("text/plain", token.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { if (textOnly) return; event.preventDefault(); const dragged = event.dataTransfer.getData("text/plain"); setTokens((items) => { const from = items.findIndex((item) => item.id === dragged); const to = items.findIndex((item) => item.id === token.id); if (from < 0 || to < 0) return items; const next = [...items]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); setTokenOrder(next.map((item) => item.id)); return next; }); }} className="flex cursor-grab items-center gap-2 border border-border p-2"><span className="font-mono text-xs text-text-muted">{index + 1}</span><Input className="font-cjk" lang="zh-Hans" value={token.text} disabled={pending || textOnly} onChange={(event) => setTokens(tokens.map((row) => row.id === token.id ? { ...row, text: event.target.value } : row))} aria-label={`Potongan kalimat ${index + 1}`} /><span aria-hidden="true" className="text-text-muted">⠿</span></div>)}</div>
            {!textOnly && tokens.length < 30 ? <Button type="button" size="sm" variant="secondary" onClick={() => { const next = [...tokens, { id: `token-${crypto.randomUUID()}`, text: "" }]; setTokens(next); setTokenOrder(next.map((item) => item.id)); }}>Tambah potongan</Button> : null}
          </div>
        ) : (
        <>
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
                placeholder="Teks opsi (opsional jika memakai gambar)"
                disabled={pending}
              />
              <input
                ref={(element) => { optionImageInputRefs.current[option.key] = element; }}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null;
                  event.currentTarget.value = "";
                  setOptions((current) => current.map((row) => row.key === option.key ? { ...row, imageFile: file, imagePath: file ? null : row.imagePath } : row));
                }}
                disabled={pending || textOnly}
              />
              <Button type="button" size="sm" variant="secondary" onClick={() => optionImageInputRefs.current[option.key]?.click()} disabled={pending || textOnly}>
              {option.imageFile?.name ?? (option.imagePath ? "Ganti gambar" : "Unggah gambar")}
            </Button>
              {option.imageUrl && !option.imageFile ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={option.imageUrl} alt={`Gambar opsi ${LABELS[index]}`} className="max-h-28 max-w-40 object-contain" />
              ) : null}
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
              ? sharedListeningAudioUrl
                ? "Pakai audio bersama tes atau unggah audio khusus soal ini. Format MP3."
                : "Wajib untuk Listening. Format MP3."
              : "Opsional. Format MP3."
          }
          required={section === "listening" && !sharedListeningAudioUrl}
        >
          <div className="flex flex-col gap-2">
            {section === "listening" && !hasAudio && sharedListeningAudioUrl ? (
              <div className="flex flex-col gap-2 rounded-sm border border-border bg-surface-muted p-3">
                <p className="text-xs text-text-muted">Audio bersama tes digunakan untuk soal ini.</p>
                <audio controls preload="none" controlsList="nodownload" className="w-full" aria-label="Audio Listening bersama">
                  <source src={sharedListeningAudioUrl} type="audio/mpeg" />
                </audio>
              </div>
            ) : null}
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
        </>
        )}

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
