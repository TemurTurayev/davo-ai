"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-tg-button)] text-[var(--color-tg-button-text)] hover:brightness-110 shadow-[0_2px_8px_rgba(14,165,164,0.25)]",
        secondary:
          "bg-[var(--color-tg-secondary-bg)] text-[var(--color-tg-text)] border border-[var(--color-slate-200)] hover:bg-[var(--color-mist)]",
        ghost:
          "bg-transparent text-[var(--color-tg-text)] hover:bg-[var(--color-mist)]",
        outline:
          "border border-[var(--color-brand)] text-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]",
        danger:
          "bg-[var(--color-danger)] text-white hover:brightness-110",
      },
      size: {
        sm: "h-10 px-4 text-sm rounded-[10px]",
        md: "h-12 px-5 text-base rounded-[12px]",
        lg: "h-14 px-6 text-base rounded-[14px]",
        icon: "h-12 w-12 rounded-full",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      block: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, block, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
