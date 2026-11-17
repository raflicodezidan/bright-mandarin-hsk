import * as React from "react";
import { cn } from "@/lib/utils";

export type TableProps = React.TableHTMLAttributes<HTMLTableElement> & {
  caption?: string;
};

export function Table({ className, caption, children, ...props }: TableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn(
          "w-full border-collapse border border-border text-left text-sm",
          className,
        )}
        {...props}
      >
        {caption ? (
          <caption className="border-b border-border px-4 py-3 text-left text-xs text-text-muted">
            {caption}
          </caption>
        ) : null}
        {children}
      </table>
    </div>
  );
}

export function TableHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn("bg-surface", className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("divide-y divide-border", className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("h-12 border-b border-border bg-paper transition-colors duration-150 hover:bg-[#F1EFE9]", className)}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  className,
  numeric = false,
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "sticky top-0 h-10 whitespace-nowrap border-r border-border px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-[#71717A]",
        numeric && "tabular",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({
  className,
  numeric = false,
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        "border-r border-border px-4 py-3 text-center align-middle text-sm text-text",
        numeric && "whitespace-nowrap tabular",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}
