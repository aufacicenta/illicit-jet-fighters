import { useEffect, useState } from "react";

import { useWizardContext } from "../../../context/Wizard/useWizardContext";
import { generateSpecsheetImage } from "../../../lib/api";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../components/ui/collapsible";
import { Skeleton } from "../../../components/ui/skeleton";
import { Textarea } from "../../../components/ui/textarea";
import { LockedSection } from "./LockedSection";

export const SpecsheetSection = () => {
  const { outputs, sectionStatuses, activeSectionId, setActiveSection, saveEditedSection } =
    useWizardContext();
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(outputs["specsheet-prompt"]?.content ?? "");
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);

  useEffect(() => {
    setDraftPrompt(outputs["specsheet-prompt"]?.content ?? "");
  }, [outputs]);

  if (sectionStatuses["specsheet-prompt"] === "locked") {
    return <LockedSection title="Specsheet" />;
  }

  const imageOutput = outputs["specsheet-image"];
  const imageStatus = sectionStatuses["specsheet-image"];

  return (
    <Card
      className={activeSectionId === "specsheet-image" ? "border-sky-500" : undefined}
      onClick={() => setActiveSection("specsheet-image")}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Specsheet</CardTitle>
        <div className="flex gap-2">
          <Badge variant="secondary">prompt: {sectionStatuses["specsheet-prompt"]}</Badge>
          <Badge variant={imageStatus === "complete" ? "default" : "secondary"}>
            image: {imageStatus}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {imageStatus === "generating" || isRegeneratingImage ? (
          <div className="space-y-2">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : imageOutput ? (
          <img
            alt="Generated specsheet"
            className="max-h-[560px] w-full rounded-md border border-slate-800 object-contain"
            src={imageOutput.content}
          />
        ) : (
          <p className="text-sm text-slate-400">Specsheet image will appear here.</p>
        )}

        <Collapsible defaultOpen>
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="outline">
              Toggle prompt
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            {isEditingPrompt ? (
              <Textarea
                className="min-h-[220px] font-mono text-xs"
                value={draftPrompt}
                onChange={(event) => setDraftPrompt(event.target.value)}
              />
            ) : (
              <pre className="max-h-[300px] overflow-auto rounded-md bg-slate-900 p-3 text-xs whitespace-pre-wrap">
                {outputs["specsheet-prompt"]?.content ?? "No prompt generated yet."}
              </pre>
            )}
          </CollapsibleContent>
        </Collapsible>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              setIsEditingPrompt((value) => !value);
            }}
          >
            {isEditingPrompt ? "Cancel edit" : "Edit prompt"}
          </Button>
          {isEditingPrompt ? (
            <Button
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                saveEditedSection("specsheet-prompt", draftPrompt);
                setIsEditingPrompt(false);
              }}
            >
              Save prompt
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            onClick={async (event) => {
              event.stopPropagation();
              const prompt = outputs["specsheet-prompt"]?.content ?? draftPrompt;
              if (!prompt) {
                return;
              }
              setIsRegeneratingImage(true);
              try {
                const generated = await generateSpecsheetImage(prompt);
                saveEditedSection("specsheet-image", generated.imageBase64);
              } finally {
                setIsRegeneratingImage(false);
              }
            }}
          >
            Regenerate image
          </Button>
          {imageOutput ? (
            <a
              className="inline-flex h-9 items-center rounded-md border border-slate-700 px-3 text-sm text-slate-100 hover:bg-slate-800"
              download={`fighter-${imageOutput.sectionId}.jpeg`}
              href={imageOutput.content}
              onClick={(event) => event.stopPropagation()}
            >
              Download
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};
