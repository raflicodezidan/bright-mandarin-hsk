"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  deleteStudentAction,
  resetStudentPasswordAction,
  toggleStudentActiveAction,
  updateStudentNameAction,
} from "@/app/admin/students/actions";

export type StudentRow = {
  id: string;
  fullName: string;
  username: string;
  isActive: boolean;
};

export function StudentRowActions({ student }: { student: StudentRow }) {
  const router = useRouter();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [dialog, setDialog] = React.useState<
    "edit" | "reset" | "toggle" | "delete" | null
  >(null);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [fullName, setFullName] = React.useState(student.fullName);
  const [newPassword, setNewPassword] = React.useState<string | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function openDialog(next: NonNullable<typeof dialog>) {
    setMenuOpen(false);
    setError(null);
    setNewPassword(null);
    setFullName(student.fullName);
    setDialog(next);
  }

  function closeDialog() {
    setDialog(null);
    setError(null);
    setNewPassword(null);
  }

  function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateStudentNameAction({
        studentId: student.id,
        fullName,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast("Nama murid diperbarui.");
      closeDialog();
      router.refresh();
    });
  }

  function resetPassword() {
    setError(null);
    startTransition(async () => {
      const result = await resetStudentPasswordAction({ studentId: student.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNewPassword(result.data.password);
      toast("Password murid direset.");
    });
  }

  function toggleActive() {
    setError(null);
    startTransition(async () => {
      const result = await toggleStudentActiveAction({
        studentId: student.id,
        isActive: !student.isActive,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast(
        student.isActive ? "Murid dinonaktifkan." : "Murid diaktifkan kembali.",
      );
      closeDialog();
      router.refresh();
    });
  }

  function removeStudent() {
    setError(null);
    startTransition(async () => {
      const result = await deleteStudentAction({ studentId: student.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast("Murid dihapus.");
      closeDialog();
      router.refresh();
    });
  }

  async function copyPassword() {
    if (!newPassword) return;
    await navigator.clipboard.writeText(newPassword);
    toast("Password disalin.");
  }

  return (
    <>
      <div ref={menuRef} className="relative inline-block text-left">
        <button
          type="button"
          aria-label={`Aksi untuk ${student.fullName}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setMenuOpen(false);
          }}
          className="rounded-sm p-2 text-text-muted hover:bg-surface-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <MoreHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-full z-20 mt-1 flex w-44 flex-col rounded-sm border border-border bg-surface py-1 shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
          >
            <button
              type="button"
              role="menuitem"
              className="px-3 py-2 text-left text-sm hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
              onClick={() => openDialog("edit")}
            >
              Edit nama
            </button>
            <button
              type="button"
              role="menuitem"
              className="px-3 py-2 text-left text-sm hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
              onClick={() => openDialog("reset")}
            >
              Reset password
            </button>
            <button
              type="button"
              role="menuitem"
              className="px-3 py-2 text-left text-sm hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
              onClick={() => openDialog("toggle")}
            >
              {student.isActive ? "Nonaktifkan" : "Aktifkan"}
            </button>
            <button
              type="button"
              role="menuitem"
              className="px-3 py-2 text-left text-sm text-accent hover:bg-accent-subtle focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
              onClick={() => openDialog("delete")}
            >
              Hapus
            </button>
          </div>
        ) : null}
      </div>

      <Dialog
        open={dialog === "edit"}
        onClose={closeDialog}
        title={`Edit nama ${student.fullName}`}
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog} disabled={pending}>
              Batal
            </Button>
            <Button type="submit" form="edit-student-form" loading={pending}>
              Simpan
            </Button>
          </>
        }
      >
        <form id="edit-student-form" onSubmit={saveName} className="flex flex-col gap-4">
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Field label="Nama lengkap" htmlFor={`name-${student.id}`} required>
            <Input
              id={`name-${student.id}`}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              maxLength={120}
              required
              disabled={pending}
            />
          </Field>
        </form>
      </Dialog>

      <Dialog
        open={dialog === "reset"}
        onClose={closeDialog}
        title={`Reset password ${student.fullName}?`}
        description="Password lama tidak berlaku lagi. Password baru hanya ditampilkan sekali."
        footer={
          newPassword ? (
            <Button onClick={closeDialog}>Selesai</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={closeDialog} disabled={pending}>
                Batal
              </Button>
              <Button onClick={resetPassword} loading={pending}>
                Reset password
              </Button>
            </>
          )
        }
      >
        {newPassword ? (
          <div className="flex flex-col gap-4">
            <Alert tone="warning">
              Salin password baru sekarang. Password tidak ditampilkan lagi.
            </Alert>
            <div className="flex items-center gap-2">
              <span className="rounded-sm border border-border bg-surface-muted px-3 py-2 font-mono text-sm">
                {newPassword}
              </span>
              <Button size="sm" variant="secondary" onClick={copyPassword}>
                Salin
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {error ? <Alert tone="error">{error}</Alert> : null}
            <p className="text-sm text-text-muted">
              Password baru akan dibuat otomatis.
            </p>
          </div>
        )}
      </Dialog>

      <Dialog
        open={dialog === "toggle"}
        onClose={closeDialog}
        title={
          student.isActive
            ? `Nonaktifkan ${student.fullName}?`
            : `Aktifkan ${student.fullName}?`
        }
        description={
          student.isActive
            ? "Murid tidak dapat masuk sampai akun diaktifkan kembali."
            : "Murid dapat masuk kembali dengan password yang sama."
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog} disabled={pending}>
              Batal
            </Button>
            <Button
              variant={student.isActive ? "danger" : "primary"}
              onClick={toggleActive}
              loading={pending}
            >
              {student.isActive ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </>
        }
      >
        {error ? <Alert tone="error">{error}</Alert> : null}
        <p className="text-sm text-text-muted">
          Riwayat hasil tidak terpengaruh.
        </p>
      </Dialog>

      <Dialog
        open={dialog === "delete"}
        onClose={closeDialog}
        title={`Hapus murid ${student.fullName}?`}
        description="Akun dan data murid akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog} disabled={pending}>
              Batal
            </Button>
            <Button variant="danger" onClick={removeStudent} loading={pending}>
              Hapus
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {error ? <Alert tone="error">{error}</Alert> : null}
          <p className="text-sm text-text-muted">
            Jika murid sudah punya riwayat hasil, penghapusan akan ditolak.
            Nonaktifkan akunnya sebagai gantinya.
          </p>
        </div>
      </Dialog>
    </>
  );
}
