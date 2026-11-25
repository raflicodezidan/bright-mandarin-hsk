"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  assignStudentAction,
  unassignStudentAction,
} from "@/app/admin/teachers/actions";

type TeacherOption = { id: string; fullName: string };

export function StudentTeacherAssignment({
  studentId,
  studentName,
  currentTeacherId,
  teachers,
}: {
  studentId: string;
  studentName: string;
  currentTeacherId: string | null;
  teachers: TeacherOption[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [teacherId, setTeacherId] = React.useState(currentTeacherId ?? "");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function close() {
    setOpen(false);
    setTeacherId(currentTeacherId ?? "");
    setError(null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = teacherId
        ? await assignStudentAction({ teacherId, studentId })
        : await unassignStudentAction({ studentId });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast(
        teacherId
          ? "Murid berhasil dipasangkan dengan laoshi."
          : "Pasangan laoshi murid dihapus.",
      );
      close();
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-text-muted">
          {currentTeacherId
            ? teachers.find((teacher) => teacher.id === currentTeacherId)?.fullName ?? "Guru tidak aktif"
            : "Belum dipasangkan"}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={<Link2 size={14} strokeWidth={1.5} aria-hidden="true" />}
          onClick={() => {
            setTeacherId(currentTeacherId ?? "");
            setError(null);
            setOpen(true);
          }}
        >
          Pasangkan dengan laoshi
        </Button>
      </div>

      <Dialog
        open={open}
        onClose={close}
        title="Pasangkan murid dengan laoshi"
        description={`Pilih laoshi untuk ${studentName}. Setiap murid hanya dapat memiliki satu laoshi aktif.`}
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={pending}>
              Batal
            </Button>
            <Button type="submit" form="student-teacher-form" loading={pending}>
              Simpan pasangan
            </Button>
          </>
        }
      >
        <form
          id="student-teacher-form"
          onSubmit={submit}
          className="flex flex-col gap-4"
        >
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Field label="Laoshi" htmlFor={`teacher-for-${studentId}`} required>
            <Select
              id={`teacher-for-${studentId}`}
              value={teacherId}
              onChange={(event) => setTeacherId(event.target.value)}
              disabled={pending}
            >
              <option value="">Belum dipasangkan</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.fullName}
                </option>
              ))}
            </Select>
          </Field>
          {currentTeacherId && teacherId !== currentTeacherId ? (
            <Alert tone="warning">
              Jika memilih laoshi lain, pasangan lama akan diganti. Riwayat
              pengerjaan tetap tersimpan.
            </Alert>
          ) : null}
        </form>
      </Dialog>
    </>
  );
}
