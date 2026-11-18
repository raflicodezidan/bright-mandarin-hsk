"use client";

import * as React from "react";
import { createPortal } from "react-dom";
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
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number } | null>(
    null,
  );
  const [dialog, setDialog] = React.useState<
    "edit" | "reset" | "toggle" | "delete" | null
  >(null);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [fullName, setFullName] = React.useState(student.fullName);
  const [password, setPassword] = React.useState("");
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const menuContentRef = React.useRef<HTMLDivElement | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);

  const MENU_WIDTH = 176;

  React.useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (menuContentRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    function onScroll() {
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  function toggleMenu() {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const estimatedHeight = 160;
    const openUp = rect.bottom + estimatedHeight > window.innerHeight;
    setMenuPos({
      top: openUp ? rect.top - estimatedHeight - 4 : rect.bottom + 4,
      left: Math.max(8, rect.right - MENU_WIDTH),
    });
    setMenuOpen(true);
  }

  function openDialog(next: NonNullable<typeof dialog>) {
    setMenuOpen(false);
    setError(null);
    setPassword("");
    setFullName(student.fullName);
    setDialog(next);
  }

  function closeDialog() {
    setDialog(null);
    setError(null);
    setPassword("");
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

  function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await resetStudentPasswordAction({
        studentId: student.id,
        password,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast("Password murid diperbarui.");
      closeDialog();
      router.refresh();
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

  return (
    <>
      <div ref={menuRef} className="relative inline-block text-left">
        <button
          ref={buttonRef}
          type="button"
          aria-label={`Aksi untuk ${student.fullName}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={toggleMenu}
          onKeyDown={(event) => {
            if (event.key === "Escape") setMenuOpen(false);
          }}
          className="rounded-sm p-2 text-text-muted hover:bg-surface-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <MoreHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
        {menuOpen && menuPos
          ? createPortal(
              <div
                ref={menuContentRef}
                role="menu"
                style={{
                  position: "fixed",
                  top: menuPos.top,
                  left: menuPos.left,
                  width: MENU_WIDTH,
                }}
                className="z-50 flex flex-col rounded-[2px] border border-border bg-surface py-1"
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
                  className="px-3 py-2 text-left text-sm text-[#A62626] hover:bg-[#FDF2F2] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
                  onClick={() => openDialog("delete")}
                >
                  Hapus
                </button>
              </div>,
              document.body,
            )
          : null}
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
        description="Masukkan password baru untuk murid. Password lama tidak berlaku lagi."
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog} disabled={pending}>
              Batal
            </Button>
            <Button
              type="submit"
              form={`reset-password-${student.id}`}
              loading={pending}
            >
              Simpan password
            </Button>
          </>
        }
      >
        <form
          id={`reset-password-${student.id}`}
          onSubmit={resetPassword}
          className="flex flex-col gap-4"
        >
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Field
            label="Password baru"
            htmlFor={`reset-password-input-${student.id}`}
            hint="Minimal 8 karakter. Sampaikan password ini langsung kepada murid."
            required
          >
            <Input
              id={`reset-password-input-${student.id}`}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              maxLength={100}
              required
              disabled={pending}
            />
          </Field>
        </form>
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
