import { useEffect, useRef, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../components/ui/collapsible";
import { Skeleton } from "../../../components/ui/skeleton";
import { useWizardContext } from "../../../context/Wizard/useWizardContext";

export const DescriptionSection = () => {
  const { outputs, sectionStatuses, setActiveSection, activeSectionId } = useWizardContext();
  const status = sectionStatuses["character-description"];
  const description = outputs["character-description"]?.content;
  const [isNarrativeVisible, setIsNarrativeVisible] = useState(true);
  const narrativeContainerRef = useRef<HTMLPreElement | null>(null);

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
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Full Briefing</CardTitle>
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
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
              Live briefing narrative
            </p>
            <pre
              className="max-h-[300px] overflow-auto rounded-sm border border-border bg-background p-3 text-xs whitespace-pre-wrap"
              ref={narrativeContainerRef}
            >
              {description}
            </pre>
          </div>
        ) : description ? (
          <Collapsible open={isNarrativeVisible} onOpenChange={setIsNarrativeVisible}>
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="outline">
                {isNarrativeVisible ? "Hide briefing narrative" : "Show briefing narrative"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <pre
                className="max-h-[300px] overflow-auto rounded-sm border border-border bg-background p-3 text-xs whitespace-pre-wrap"
                ref={narrativeContainerRef}
              >
                {description}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <p className="text-sm text-muted-foreground">
            Briefing narrative will appear after pilot intake begins.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
