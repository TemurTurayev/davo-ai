import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "strong" | "brand" | "accent" | "outline";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  asChild?: boolean;
}

const variantClass: Record<Variant, string> = {
  default: "glass",
  strong: "glass-strong",
  brand: "glass-brand",
  accent: "glass-accent",
  outline: "gradient-border",
};

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(variantClass[variant], "p-4", className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
GlassCard.displayName = "GlassCard";
