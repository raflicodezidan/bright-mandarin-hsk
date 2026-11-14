import * as React from "react";
import Link from "next/link";
import {
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/button";

export type LinkButtonProps = React.ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}
