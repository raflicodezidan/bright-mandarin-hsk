"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { assignStudentAction } from "@/app/admin/teachers/actions";

export type AssignableStudent = {
  id: string;
  fullName: string;
  username: string;
  currentTeacherName: string | null;
};

export function AssignStudentDialog({
  teacherId,
  students,
}: {
  teacherId: string;
  students: AssignableStudent[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [search, setSearch] = React.useState("");
  const [studentId, setStudentId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return students;
    return students.filter(
      (student) =>
        student.fullName.toLowerCase().includes(keyword) ||
        student.username.toLowerCase().includes(keyword),
    );
  }, [search, students]);

  const selected = students.find((student) => student.id === studentId);

  function reset() {
    setSearch("");
    setStudentId("");
    setError(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studentId) {
      setError("Pilih murid terlebih dahulu.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await assignStudentAction({ teacherId, studentId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast("Murid berhasil ditugaskan ke guru ini.");
      close();
      router.refresh();
    });
  }

  return (
    <>
      <Button
        icon={<UserPlus size={16} strokeWidth={1.5} aria-hidden="true" />}
        onClick={() => setOpen(true)}
        disabled={students.length === 0}
      >
        Tambah murid
      </Button>

      <Dialog
        open={open}
        onClose={close}
        title="Tugaskan murid"
        description="Murid hanya memiliki satu guru aktif. Menugaskan murid yang sudah punya guru akan memindahkannya."
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={pending}>
              Batal
            </Button>
            <Button
              type="submit"
              form="assign-student-form"
              loading={pending}
              disabled={!studentId}
            >
              Tugaskan
            </Button>
          </>
        }
      >
        <form
          id="assign-student-form"
          onSubmit={submit}
          className="flex flex-col gap-4"
        >
          {error ? <Alert tone="error">{error}</Alert> : null}

          {students.length === 0 ? (
            <p className="text-sm text-text-muted">
              Semua murid aktif sudah diampu guru ini.
            </p>
          ) : (
            <>
              <Field label="Cari murid" htmlFor="assign-student-search">
                <Input
                  id="assign-student-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nama atau username"
                  autoComplete="off"
                  disabled={pending}
                />
              </Field>

              <Field label="Murid" htmlFor="assign-student-select" required>
                <Select
                  id="assign-student-select"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  disabled={pending || filtered.length === 0}
                  required
                >
                  <option value="">Pilih murid</option>
                  {filtered.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.fullName} ({student.username})
                      {student.currentTeacherName
                        ? ` — guru: ${student.currentTeacherName}`
                        : " — belum ada guru"}
                    </option>
                  ))}
                </Select>
              </Field>

              {filtered.length === 0 ? (
                <p className="text-xs text-text-muted">
                  Tidak ada murid yang cocok dengan pencarian.
                </p>
              ) : null}

              {selected?.currentTeacherName ? (
                <Alert tone="warning">
                  {selected.fullName} saat ini diampu {selected.currentTeacherName}.
                  Penugasan lama akan diakhiri dan riwayat hasil tetap mengikuti
                  murid.
                </Alert>
              ) : null}
            </>
          )}
        </form>
      </Dialog>
    </>
  );
}
