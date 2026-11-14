import * as React from "react";
import { cn } from "@/lib/utils";

export type TableProps = React.TableHTMLAttributes<HTMLTableElement> & {
  caption?: string;
};

export function Table({ className, caption, children, ...props }: TableProps) {
  return (
    <div className="rounded-md border border-border bg-surface">
      <div className="w-full overflow-x-auto">
        <table
          className={cn("w-full border-collapse text-left text-sm", className)}
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
    </div>
  );
}

export function TableHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn("bg-surface-muted", className)} {...props}>
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
      className={cn("h-12 transition-colors duration-150 hover:bg-surface-muted", className)}
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
        "sticky top-0 h-10 px-4 py-3 text-xs font-semibold text-text-muted",
        numeric ? "text-right tabular" : "text-left",
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
        "px-4 py-3 align-middle text-sm text-text",
        numeric && "text-right tabular",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}
