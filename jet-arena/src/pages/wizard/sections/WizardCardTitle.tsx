import { type ComponentPropsWithoutRef } from "react";

import { CardTitle } from "../../../components/ui/card";
import { cn } from "../../../lib/utils";
import { wizardCardTitleClassName } from "./SectionStatusBadge";

type WizardCardTitleProps = ComponentPropsWithoutRef<typeof CardTitle>;

export const WizardCardTitle = ({ children, className, ...props }: WizardCardTitleProps) => (
  <CardTitle
    className={cn("inline-flex items-end gap-1.5", wizardCardTitleClassName, className)}
    {...props}
  >
    <span>{children}</span>
    <span
      aria-hidden
      className="inline-block h-1 w-2 animate-pulse bg-current opacity-80 [animation-duration:900ms]"
    />
  </CardTitle>
);
