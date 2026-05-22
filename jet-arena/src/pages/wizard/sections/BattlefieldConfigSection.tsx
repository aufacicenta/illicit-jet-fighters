import "highlight.js/styles/github-dark.css";

import hljs from "highlight.js/lib/core";
import json from "highlight.js/lib/languages/json";
import { useEffect, useRef } from "react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { useBattlefieldWizardContext } from "../../../context/BattlefieldWizard/useBattlefieldWizardContext";
import { BattlefieldSectionCostBadge } from "./BattlefieldSectionCostBadge";
import {
  BattlefieldSectionStatusBadge,
  wizardCardHeaderClassName,
} from "./BattlefieldSectionStatusBadge";
import { WizardCardTitle } from "./WizardCardTitle";

hljs.registerLanguage("json", json);

export const BattlefieldConfigSection = () => {
  const { outputs, sectionStatuses, setActiveSection, activeSectionId, requestRegenerateConfig } =
    useBattlefieldWizardContext();
  const status = sectionStatuses["battlefield-config"];
  const config = outputs["battlefield-config"]?.content;
  const hasDescription = Boolean(outputs["battlefield-description"]?.content);
  const codeContainerRef = useRef<HTMLPreElement | null>(null);
  const codeElementRef = useRef<HTMLElement | null>(null);
  const isRegenerateDisabled = status === "generating" || !hasDescription;
  const displayStatus = status === "locked" && hasDescription && !config ? "ready" : status;

  useEffect(() => {
    if (!config) {
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
  }, [config]);

  useEffect(() => {
    if (!config || !codeElementRef.current) {
      return;
    }

    hljs.highlightElement(codeElementRef.current);
  }, [config]);

  return (
    <Card
      className={activeSectionId === "battlefield-config" ? "border-secondary" : undefined}
      onClick={() => setActiveSection("battlefield-config")}
    >
      <CardHeader
        className={`flex flex-row items-center justify-between gap-2 ${wizardCardHeaderClassName}`}
      >
        <WizardCardTitle>Battlefield Config</WizardCardTitle>
        <div className="flex items-center gap-2">
          <Button
            disabled={isRegenerateDisabled}
            onClick={(event) => {
              event.stopPropagation();
              void requestRegenerateConfig();
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            {status === "generating"
              ? "Regenerating..."
              : status === "error"
                ? "Retry"
                : "Regenerate"}
          </Button>
          <BattlefieldSectionCostBadge sectionIds={["battlefield-config"]} />
          <BattlefieldSectionStatusBadge status={displayStatus} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "generating" && !config ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-9/12" />
          </div>
        ) : config ? (
          <pre
            className="max-h-[420px] overflow-auto rounded-sm border border-border bg-background p-3 text-xs whitespace-pre-wrap"
            ref={codeContainerRef}
          >
            <code className="language-json" ref={codeElementRef}>
              {config}
            </code>
          </pre>
        ) : (
          <p className="p-3 text-sm text-muted-foreground">
            Battlefield config JSON appears after generation.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
