"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  createTestAction,
  updateTestAction,
} from "@/app/admin/tests/actions";

export type TestFormValues = {
  title: string;
  level: number;
  description: string;
  durationMinutes: number;
};

export function TestForm({
  mode,
  testId,
  initial,
  lockedDuration = false,
}: {
  mode: "create" | "edit";
  testId?: string;
  initial?: TestFormValues;
  lockedDuration?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [level, setLevel] = React.useState(String(initial?.level ?? 1));
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [duration, setDuration] = React.useState(
    String(initial?.durationMinutes ?? 35),
  );

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      if (mode === "create") {
        const result = await createTestAction({
          title,
          level,
          description,
          durationMinutes: duration,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast("Tes berhasil dibuat.");
        router.push(`/admin/tests/${result.data.id}`);
        return;
      }

      if (!testId) return;
      const result = await updateTestAction({
        testId,
        title,
        level: Number(level),
        description,
        durationMinutes: Number(duration),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast("Perubahan tes disimpan.");
      router.refresh();
    });
  }

  return (
    <Card title={mode === "create" ? "Detail tes" : undefined}>
      <form onSubmit={onSubmit} className="flex max-w-[640px] flex-col gap-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {lockedDuration ? (
          <Alert tone="warning" title="Tes sudah memiliki pengerjaan">
            Judul, deskripsi, level HSK, dan durasi dapat diubah. Durasi baru
            berlaku untuk pengerjaan berikutnya. Perubahan kunci jawaban akan
            menghitung ulang nilai pengerjaan yang sudah selesai.
          </Alert>
        ) : null}

        <Field label="Judul" htmlFor="test-title" required>
          <Input
            id="test-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required
            disabled={pending}
          />
        </Field>

        <Field label="Level HSK" htmlFor="test-level" required>
          <Select
            id="test-level"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            disabled={pending}
          >
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <option key={item} value={item}>
                HSK {item}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Durasi (menit)" htmlFor="test-duration" required>
          <Input
            id="test-duration"
            type="number"
            min={5}
            max={240}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            required
            disabled={pending}
          />
        </Field>

        <Field
          label="Deskripsi / instruksi"
          htmlFor="test-description"
          hint="Ditampilkan pada halaman instruksi murid."
        >
          <Textarea
            id="test-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={4000}
            disabled={pending}
          />
        </Field>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" loading={pending}>
            {mode === "create" ? "Buat tes" : "Simpan"}
          </Button>
          {mode === "create" ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/admin/tests")}
              disabled={pending}
            >
              Batal
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
