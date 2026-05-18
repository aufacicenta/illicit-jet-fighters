import { SendHorizontal } from "lucide-react";
import { useMemo } from "react";

import { Button } from "../../components/ui/button";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Textarea } from "../../components/ui/textarea";
import { useWizardContext } from "../../context/Wizard/useWizardContext";

const sectionLabels = {
  "character-description": "Character Description",
  "specsheet-prompt": "Specsheet Prompt",
  "specsheet-image": "Specsheet Image",
} as const;

export const PromptBar = () => {
  const {
    activeSectionId,
    gateMessage,
    promptInput,
    setPromptInput,
    submitPrompt,
    requestContinuePipeline,
    sectionHistories,
  } = useWizardContext();

  const history = useMemo(
    () => (activeSectionId ? (sectionHistories[activeSectionId] ?? []) : []),
    [activeSectionId, sectionHistories],
  );

  return (
    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/90 p-4">
      <div className="flex flex-col gap-3">
        {gateMessage ? (
          <div className="flex items-center justify-between rounded-md border border-sky-600/40 bg-sky-950/30 p-3 text-sm text-sky-100">
            <span>{gateMessage}</span>
            <Button size="sm" onClick={requestContinuePipeline}>
              Continue
            </Button>
          </div>
        ) : null}

        {activeSectionId ? (
          <div className="text-sm text-slate-300">
            Refining: <span className="font-semibold">{sectionLabels[activeSectionId]}</span>
          </div>
        ) : (
          <div className="text-sm text-slate-300">Initial prompt</div>
        )}

        {history.length > 0 ? (
          <ScrollArea className="h-24 rounded-md border border-slate-800 bg-slate-900/60 p-2">
            <div className="space-y-2 text-xs">
              {history.map((entry, index) => (
                <div key={`${entry.role}-${index}`}>
                  <span className="font-semibold text-slate-400 uppercase">{entry.role}</span>
                  <p className="text-slate-200">{entry.content}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : null}

        <div className="relative">
          <Textarea
            className="min-h-20 w-full pr-14"
            onChange={(event) => setPromptInput(event.target.value)}
            placeholder={
              activeSectionId
                ? "Refine this section..."
                : "Describe your fighter's key traits, role, and vibe..."
            }
            value={promptInput}
          />
          <Button
            className="absolute right-2 bottom-2 h-9! w-9! rounded-full p-0"
            size="sm"
            onClick={() => {
              void submitPrompt();
            }}
            type="button"
          >
            <SendHorizontal className="size-4" />
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
