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
        gradient:
          "group relative rounded-md bg-[length:200%] bg-[linear-gradient(45deg,var(--color-1),var(--color-5),var(--color-3),var(--color-4),var(--color-2))] animate-rainbow active:scale-[0.95] overflow-hidden",
        cockpit:
          "group relative overflow-hidden border-0 bg-transparent font-bold tracking-wide text-foreground active:scale-[0.98]",
      },
      size: {
        xs: "p-1 text-[9px]",
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
  ({ className, variant, size, asChild = false, fullWidth, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const isGradient = variant === "gradient";
    const isCockpit = variant === "cockpit";
    const cockpitMaskStyle: React.CSSProperties = {
      WebkitMaskImage: "url('/cockpit-bottom-right-button.svg')",
      WebkitMaskPosition: "center",
      WebkitMaskRepeat: "no-repeat",
      WebkitMaskSize: "100% 100%",
      maskImage: "url('/cockpit-bottom-right-button.svg')",
      maskPosition: "center",
      maskRepeat: "no-repeat",
      maskSize: "100% 100%",
    };

    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), fullWidth && "flex w-full", className)}
        ref={ref}
        {...props}
      >
        {isGradient ? (
          <>
            <div className="absolute inset-[1.5px] z-0 rounded-sm bg-background/95 saturate-200 backdrop-blur-3xl transition-all group-hover:bg-background/40" />
            <span className="pointer-events-none z-10 text-foreground">
              {children ?? "Gradient Border"}
            </span>
          </>
        ) : isCockpit ? (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0 bg-[#a9480e]"
              style={cockpitMaskStyle}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-1 opacity-80 blur-[1.5px] group-hover:opacity-100"
              style={{
                ...cockpitMaskStyle,
                background:
                  "conic-gradient(from var(--border-angle), #ffd47a, #ff7a18, #ff4500, #ffd47a)",
                animation: "cockpit-border-rotate 3s linear infinite",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-[2px] z-2 bg-[#2a070d]"
              style={cockpitMaskStyle}
            />
            <img
              aria-hidden
              alt=""
              src="/cockpit-bottom-right-button.svg"
              className="pointer-events-none absolute inset-0 z-3 h-full w-full object-fill opacity-55 mix-blend-screen"
            />
            <span className="pointer-events-none relative z-10 px-4">{children}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";
