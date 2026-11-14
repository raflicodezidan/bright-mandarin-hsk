import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-sm border border-border-strong bg-surface px-3 text-sm text-text placeholder:text-text-muted transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted aria-[invalid=true]:border-accent";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return <input className={cn(fieldBase, "h-10", className)} {...props} />;
}

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(fieldBase, "min-h-24 py-2 leading-6", className)}
      {...props}
    />
  );
}

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select className={cn(fieldBase, "h-10 pr-8", className)} {...props}>
      {children}
    </select>
  );
}
