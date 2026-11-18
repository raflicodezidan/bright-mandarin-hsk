"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "lg";
  presentation?: "dialog" | "drawer";
  drawerWidth?: number;
  accentColor?: string;
  examModal?: boolean;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "sm",
  presentation = "dialog",
  drawerWidth = 420,
  accentColor = "#1B5E3A",
  examModal = false,
}: DialogProps) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const onCloseRef = React.useRef(onClose);
  const titleId = React.useId();
  const descId = React.useId();

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>(FOCUSABLE);
    (focusables?.[0] ?? panel)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const scrollLock = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = scrollLock;
      previous?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
        className={cn(
          "fixed inset-0 z-50",
          presentation === "drawer"
            ? "flex justify-end"
            : "flex items-center justify-center p-4",
        )}
      >
      <button
        type="button"
        aria-label="Tutup dialog"
        className={cn(
          "absolute inset-0 dialog-backdrop",
          examModal ? "bg-[#18181B]/35 backdrop-blur-[2px]" : "bg-black/20",
        )}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          presentation === "drawer"
            ? "relative flex h-full w-full flex-col border-l border-[#DCD9D0] bg-[#F8F7F3] outline-none"
            : cn(
                "relative flex w-full flex-col overflow-hidden border border-[#DCD9D0] outline-none",
                examModal
                  ? "rounded-[3px] bg-[#FAF9F6] exam-modal-panel"
                  : "rounded-[2px] bg-surface dialog-panel",
              ),
        )}
        style={
          presentation === "dialog"
            ? { maxWidth: examModal ? 460 : size === "sm" ? 480 : 640, ...(examModal ? { "--exam-accent": accentColor } as React.CSSProperties : {}) }
            : { maxWidth: drawerWidth }
        }
      >
        {examModal ? <div className="exam-modal-accent h-[3px] w-full bg-[var(--exam-accent)]" aria-hidden="true" /> : null}
        <div className={cn("flex items-start justify-between gap-4 border-b border-border px-6 py-4", examModal && "bg-[#F8F7F3] exam-modal-block exam-modal-delay-1")}>
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className={cn("text-base font-semibold text-text", examModal && "text-[18px] font-bold")}>
              {title}
            </h2>
            {description ? (
              <p id={descId} className="text-xs text-text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="rounded-[2px] p-1 text-text-muted hover:bg-surface-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <div className={cn("px-6 py-5", presentation === "drawer" && "flex-1 overflow-y-auto", examModal && "bg-[#FAF9F6] exam-modal-block exam-modal-delay-2")}>{children}</div>
        {footer ? (
          <div className={cn("flex flex-wrap justify-end gap-3 border-t border-border px-6 py-4", examModal && "bg-[#F8F7F3] exam-modal-block exam-modal-delay-4")}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
