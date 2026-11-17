"use client";

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  deleteTestAction,
  duplicateTestAction,
} from "@/app/admin/tests/actions";

export type TestRow = {
  id: string;
  title: string;
  hasAttempts: boolean;
};

export function TestRowActions({ test }: { test: TestRow }) {
  const router = useRouter();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number } | null>(
    null,
  );
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const menuContentRef = React.useRef<HTMLDivElement | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);

  const MENU_WIDTH = 160;

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
    const estimatedHeight = 124;
    const openUp = rect.bottom + estimatedHeight > window.innerHeight;
    setMenuPos({
      top: openUp ? rect.top - estimatedHeight - 4 : rect.bottom + 4,
      left: Math.max(8, rect.right - MENU_WIDTH),
    });
    setMenuOpen(true);
  }

  function duplicate() {
    setMenuOpen(false);
    startTransition(async () => {
      const result = await duplicateTestAction(test.id);
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      toast(`Tes "${test.title}" diduplikat.`);
      router.push(`/admin/tests/${result.data.id}`);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteTestAction(test.id);
      if (!result.ok) {
        toast(result.error, "error");
        setDeleteOpen(false);
        return;
      }
      toast(`Tes "${test.title}" dihapus.`);
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div ref={menuRef} className="relative inline-block text-left">
        <button
          ref={buttonRef}
          type="button"
          aria-label={`Aksi untuk ${test.title}`}
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
                  disabled={pending}
                  className="px-3 py-2 text-left text-sm hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary disabled:opacity-50"
                  onClick={duplicate}
                >
                  Duplikat
                </button>
                <Link
                  role="menuitem"
                  href={`/admin/tests/${test.id}`}
                  className="px-3 py-2 text-left text-sm hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
                  onClick={() => setMenuOpen(false)}
                >
                  Kelola
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  disabled={test.hasAttempts}
                  title={
                    test.hasAttempts
                      ? "Tes tidak dapat dihapus karena sudah ada pengerjaan"
                      : undefined
                  }
                  className="px-3 py-2 text-left text-sm text-[#A62626] hover:bg-[#FDF2F2] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                  onClick={() => {
                    setMenuOpen(false);
                    setDeleteOpen(true);
                  }}
                >
                  Hapus
                </button>
              </div>,
              document.body,
            )
          : null}
      </div>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Hapus tes "${test.title}"?`}
        description="Tes, soal, opsi, kunci, dan medianya akan dihapus permanen."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteOpen(false)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button variant="danger" onClick={remove} loading={pending}>
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-muted">
          Tes yang sudah memiliki pengerjaan tidak dapat dihapus.
        </p>
      </Dialog>
    </>
  );
}
