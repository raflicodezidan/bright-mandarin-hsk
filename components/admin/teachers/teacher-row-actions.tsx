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
  resetTeacherPasswordAction,
  toggleTeacherActiveAction,
} from "@/app/admin/teachers/actions";

export type TeacherRow = {
  id: string;
  fullName: string;
  username: string;
  isActive: boolean;
};

export function TeacherRowActions({ teacher }: { teacher: TeacherRow }) {
  const router = useRouter();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState<{
    top: number;
    left: number;
  } | null>(null);
  const [dialog, setDialog] = React.useState<"reset" | "toggle" | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
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
    const estimatedHeight = 112;
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
    setDialog(next);
  }

  function closeDialog() {
    setDialog(null);
    setError(null);
    setPassword("");
  }

  function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await resetTeacherPasswordAction({
        teacherId: teacher.id,
        password,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast("Password guru diperbarui.");
      closeDialog();
      router.refresh();
    });
  }

  function toggleActive() {
    setError(null);
    startTransition(async () => {
      const result = await toggleTeacherActiveAction({
        teacherId: teacher.id,
        isActive: !teacher.isActive,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast(
        teacher.isActive ? "Guru dinonaktifkan." : "Guru diaktifkan kembali.",
      );
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
          aria-label={`Aksi untuk ${teacher.fullName}`}
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
                  {teacher.isActive ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>,
              document.body,
            )
          : null}
      </div>

      <Dialog
        open={dialog === "reset"}
        onClose={closeDialog}
        title={`Reset password ${teacher.fullName}?`}
        description="Masukkan password baru untuk guru. Password lama tidak berlaku lagi."
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog} disabled={pending}>
              Batal
            </Button>
            <Button
              type="submit"
              form={`reset-teacher-password-${teacher.id}`}
              loading={pending}
            >
              Simpan password
            </Button>
          </>
        }
      >
        <form
          id={`reset-teacher-password-${teacher.id}`}
          onSubmit={resetPassword}
          className="flex flex-col gap-4"
        >
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Field
            label="Password baru"
            htmlFor={`reset-teacher-password-input-${teacher.id}`}
            hint="Minimal 8 karakter. Sampaikan password ini langsung kepada guru."
            required
          >
            <Input
              id={`reset-teacher-password-input-${teacher.id}`}
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
          teacher.isActive
            ? `Nonaktifkan ${teacher.fullName}?`
            : `Aktifkan ${teacher.fullName}?`
        }
        description={
          teacher.isActive
            ? "Guru tidak dapat masuk sampai akun diaktifkan kembali. Murid dan tes yang terhubung tidak dihapus."
            : "Guru dapat masuk kembali dan mengelola murid serta tesnya."
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog} disabled={pending}>
              Batal
            </Button>
            <Button
              variant={teacher.isActive ? "danger" : "primary"}
              onClick={toggleActive}
              loading={pending}
            >
              {teacher.isActive ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </>
        }
      >
        {error ? <Alert tone="error">{error}</Alert> : null}
      </Dialog>
    </>
  );
}
