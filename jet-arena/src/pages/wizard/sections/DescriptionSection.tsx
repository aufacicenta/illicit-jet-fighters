import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../components/ui/collapsible";
import { Skeleton } from "../../../components/ui/skeleton";
import { useWizardContext } from "../../../context/Wizard/useWizardContext";
import { SectionCostBadge } from "./SectionCostBadge";
import { SectionStatusBadge, wizardCardHeaderClassName } from "./SectionStatusBadge";
import { WizardCardTitle } from "./WizardCardTitle";

export const DescriptionSection = () => {
  const { outputs, sectionStatuses, setActiveSection, activeSectionId } = useWizardContext();
  const status = sectionStatuses["character-description"];
  const description = outputs["character-description"]?.content;
  const [isNarrativeVisible, setIsNarrativeVisible] = useState(true);
  const narrativeContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (description) {
      setIsNarrativeVisible(true);
    }
  }, [description]);

  useEffect(() => {
    if (!description) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      if (narrativeContainerRef.current) {
        narrativeContainerRef.current.scrollTop = narrativeContainerRef.current.scrollHeight;
      }
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [description, isNarrativeVisible]);

  return (
    <Card
      className={activeSectionId === "character-description" ? "border-secondary" : undefined}
      onClick={() => setActiveSection("character-description")}
    >
      <Collapsible open={isNarrativeVisible} onOpenChange={setIsNarrativeVisible}>
        <CardHeader
          className={`flex flex-row items-center justify-between gap-2 ${wizardCardHeaderClassName}`}
        >
          <WizardCardTitle>Full Briefing</WizardCardTitle>
          <div className="flex items-center gap-2">
            {description && status !== "generating" ? (
              <CollapsibleTrigger asChild>
                <Button size="xs" variant="ghost" color="muted">
                  {isNarrativeVisible ? "Hide briefing narrative" : "Show briefing narrative"}
                </Button>
              </CollapsibleTrigger>
            ) : null}
            <SectionCostBadge sectionIds={["character-description"]} />
            <SectionStatusBadge status={status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {status === "generating" && !description ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-9/12" />
            </div>
          ) : status === "generating" && description ? (
            <div className="space-y-2">
              <pre
                className="max-h-[300px] overflow-auto rounded-sm border border-border bg-background p-3 text-xs whitespace-pre-wrap"
                ref={narrativeContainerRef as React.RefObject<HTMLPreElement>}
              >
                {description}
              </pre>
            </div>
          ) : description ? (
            <CollapsibleContent>
              <div
                className="prose prose-sm max-h-[300px] max-w-none overflow-auto rounded-sm border border-border bg-background p-3 prose-invert"
                ref={narrativeContainerRef as React.RefObject<HTMLDivElement | null>}
              >
                <Markdown>{description}</Markdown>
              </div>
            </CollapsibleContent>
          ) : (
            <p className="text-sm text-muted-foreground">
              Briefing narrative will appear after pilot intake begins.
            </p>
          )}
        </CardContent>
      </Collapsible>
    </Card>
  );
};
