import { useEffect, useState } from "react";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { Textarea } from "../../../components/ui/textarea";
import { useWizardContext } from "../../../context/Wizard/useWizardContext";
import { LockedSection } from "./LockedSection";

export const DescriptionSection = () => {
  const {
    outputs,
    sectionStatuses,
    setActiveSection,
    activeSectionId,
    saveEditedSection,
    submitPrompt,
  } = useWizardContext();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(outputs["character-description"]?.content ?? "");

  useEffect(() => {
    setDraft(outputs["character-description"]?.content ?? "");
  }, [outputs]);

  const status = sectionStatuses["character-description"];
  if (status === "locked") {
    return <LockedSection title="Character Description" />;
  }

  return (
    <Card
      className={activeSectionId === "character-description" ? "border-sky-500" : undefined}
      onClick={() => setActiveSection("character-description")}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Character Description</CardTitle>
        <Badge variant={status === "complete" ? "default" : "secondary"}>{status}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "generating" ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <>
            {!outputs["character-description"] ? (
              <div className="rounded-md border border-slate-800 bg-slate-900/50 p-3">
                <p className="text-xs text-slate-300">
                  Run this step using the current text in the prompt bar.
                </p>
                <Button
                  className="mt-2"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    void submitPrompt();
                  }}
                >
                  Run character step
                </Button>
              </div>
            ) : null}
            {isEditing ? (
              <Textarea
                className="min-h-[240px] font-mono text-xs"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            ) : (
              <pre className="max-h-[360px] overflow-auto rounded-md bg-slate-900 p-3 text-xs whitespace-pre-wrap">
                {outputs["character-description"]?.content ?? "No output yet."}
              </pre>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsEditing((value) => !value);
                }}
              >
                {isEditing ? "Cancel edit" : "Edit"}
              </Button>
              {isEditing ? (
                <Button
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    saveEditedSection("character-description", draft);
                    setIsEditing(false);
                  }}
                >
                  Save & reset downstream
                </Button>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
