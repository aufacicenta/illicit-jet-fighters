import { useEffect, useRef } from "react";

import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { useBattlefieldWizardContext } from "../../../context/BattlefieldWizard/useBattlefieldWizardContext";
import { BattlefieldSectionCostBadge } from "./BattlefieldSectionCostBadge";
import {
  BattlefieldSectionStatusBadge,
  wizardCardHeaderClassName,
} from "./BattlefieldSectionStatusBadge";
import { WizardCardTitle } from "./WizardCardTitle";

export const BattlefieldDescriptionSection = () => {
  const { outputs, sectionStatuses, setActiveSection, activeSectionId } =
    useBattlefieldWizardContext();
  const status = sectionStatuses["battlefield-description"];
  const description = outputs["battlefield-description"]?.content;
  const contentRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    if (!description) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      if (contentRef.current) {
        contentRef.current.scrollTop = contentRef.current.scrollHeight;
      }
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [description]);

  return (
    <Card
      className={activeSectionId === "battlefield-description" ? "border-secondary" : undefined}
      onClick={() => setActiveSection("battlefield-description")}
    >
      <CardHeader
        className={`flex flex-row items-center justify-between gap-2 ${wizardCardHeaderClassName}`}
      >
        <WizardCardTitle>Battlefield Description</WizardCardTitle>
        <div className="flex items-center gap-2">
          <BattlefieldSectionCostBadge sectionIds={["battlefield-description"]} />
          <BattlefieldSectionStatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "generating" && !description ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-9/12" />
          </div>
        ) : description ? (
          <pre
            className="max-h-[420px] overflow-auto rounded-sm border border-border bg-background p-3 text-xs whitespace-pre-wrap"
            ref={contentRef}
          >
            {description}
          </pre>
        ) : (
          <p className="p-3 text-sm text-muted-foreground">
            Battlefield description appears after briefing intake begins.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
