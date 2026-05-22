import "highlight.js/styles/github-dark.css";

import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import { useEffect, useRef } from "react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { Collapsible } from "../../../components/ui/collapsible";
import { Skeleton } from "../../../components/ui/skeleton";
import { useWizardContext } from "../../../context/Wizard/useWizardContext";
import { SectionCostBadge } from "./SectionCostBadge";
import { SectionStatusBadge, wizardCardHeaderClassName } from "./SectionStatusBadge";
import { WizardCardTitle } from "./WizardCardTitle";

hljs.registerLanguage("javascript", javascript);

type AgentCodeSectionProps = {
  showRegenerateButton?: boolean;
};

export const AgentCodeSection = ({ showRegenerateButton = false }: AgentCodeSectionProps) => {
  const {
    outputs,
    sectionStatuses,
    setActiveSection,
    activeSectionId,
    requestRegenerateAgentCode,
  } = useWizardContext();
  const status = sectionStatuses["agent-code"];
  const code = outputs["agent-code"]?.content;
  const hasCharacterDescription = Boolean(outputs["character-description"]?.content);
  const isRegenerateDisabled =
    status === "locked" || status === "generating" || !hasCharacterDescription;
  const codeContainerRef = useRef<HTMLPreElement | null>(null);
  const codeElementRef = useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    if (!code || !codeElementRef.current) {
      return;
    }

    hljs.highlightElement(codeElementRef.current);
  }, [code]);

  return (
    <Card
      className={activeSectionId === "agent-code" ? "border-secondary" : undefined}
      onClick={() => setActiveSection("agent-code")}
    >
      <Collapsible defaultOpen>
        <CardHeader
          className={`flex flex-row items-center justify-between gap-2 ${wizardCardHeaderClassName}`}
        >
          <WizardCardTitle>Agent Source</WizardCardTitle>
          <div className="flex items-center gap-2">
            {showRegenerateButton ? (
              <Button
                disabled={isRegenerateDisabled}
                onClick={(event) => {
                  event.stopPropagation();
                  void requestRegenerateAgentCode();
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                {status === "generating" ? "Regenerating..." : "Regenerate"}
              </Button>
            ) : null}
            <SectionCostBadge sectionIds={["agent-code"]} />
            <SectionStatusBadge status={status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {status === "generating" && !code ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-9/12" />
            </div>
          ) : code ? (
            <pre
              className="max-h-[420px] overflow-auto rounded-sm border border-border bg-background p-3 text-xs whitespace-pre-wrap"
              ref={codeContainerRef}
            >
              <code className="language-javascript" ref={codeElementRef}>
                {code}
              </code>
            </pre>
          ) : (
            <p className="p-3 text-sm text-muted-foreground">
              Agent source code will appear here after continuation starts.
            </p>
          )}
        </CardContent>
      </Collapsible>
    </Card>
  );
};
