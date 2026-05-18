import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase transition-colors",
  {
    variants: {
      variant: {
        default:
          "border border-x-primary border-t-accent border-b-[var(--color-primary-shadow)] bg-primary text-primary-foreground",
        secondary: "border-border bg-muted text-foreground",
        outline: "border-secondary/70 text-secondary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>;

export const Badge = ({ className, variant, ...props }: BadgeProps) => {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
};
