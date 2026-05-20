import { useEffect, useRef } from "react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../components/ui/collapsible";
import { Skeleton } from "../../../components/ui/skeleton";
import { useWizardContext } from "../../../context/Wizard/useWizardContext";

export const AgentCodeSection = () => {
  const { outputs, sectionStatuses, setActiveSection, activeSectionId } = useWizardContext();
  const status = sectionStatuses["agent-code"];
  const code = outputs["agent-code"]?.content;
  const codeContainerRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    if (!code) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      if (codeContainerRef.current) {
        codeContainerRef.current.scrollTop = codeContainerRef.current.scrollHeight;
      }
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [code]);

  return (
    <Card
      className={activeSectionId === "agent-code" ? "border-secondary" : undefined}
      onClick={() => setActiveSection("agent-code")}
    >
      <CardHeader>
        <CardTitle>Agent Source</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "generating" && !code ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-9/12" />
          </div>
        ) : code ? (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="outline">
                {status === "generating" ? "Live agent code stream" : "Toggle generated agent code"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <pre
                className="max-h-[420px] overflow-auto rounded-sm border border-border bg-background p-3 text-xs whitespace-pre-wrap"
                ref={codeContainerRef}
              >
                {code}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <p className="text-sm text-muted-foreground">
            Agent source code will appear here after continuation starts.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
