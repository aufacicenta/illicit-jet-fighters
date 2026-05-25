import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-xs font-bold tracking-wide uppercase transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default:
          "border border-x-primary border-t-accent border-b-[var(--color-primary-shadow)] bg-primary text-primary-foreground hover:bg-[#f05a32]",
        secondary:
          "border border-border bg-muted text-foreground hover:border-secondary hover:bg-muted/80",
        outline:
          "border border-border bg-transparent text-foreground hover:border-secondary hover:bg-muted/40",
        ghost: "text-foreground hover:bg-muted/50",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, fullWidth, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), fullWidth && "w-full", className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
