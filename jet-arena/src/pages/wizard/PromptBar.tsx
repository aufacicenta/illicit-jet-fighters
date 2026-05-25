import { SendHorizontal } from "lucide-react";
import { useCallback } from "react";

import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { useWizardContext } from "../../context/Wizard/useWizardContext";
import type { SectionId } from "../../context/Wizard/WizardContext.types";

const promptSectionLabels = {
  "character-description": "Pilot Briefing",
  "specsheet-prompt": "Specsheet Targeting",
  "specsheet-image": "Image Render",
  "spritesheet-prompt": "Spritesheet Prompt",
  "spritesheet-image": "Spritesheet Render",
  "spritesheet-manifest": "Spritesheet Manifest",
  "agent-code": "Agent Source",
  "strikecraft-specsheet-prompt": "Strikecraft Specsheet Prompt",
  "strikecraft-specsheet-image": "Strikecraft Specsheet Render",
  "strikecraft-sprite-prompt": "Strikecraft Sprite Prompt",
  "strikecraft-sprite-image": "Strikecraft Sprite Render",
} as const satisfies Record<SectionId, string>;

export const PromptBar = ({ autoFocus }: { autoFocus?: boolean }) => {
  const { sectionStatuses, outputs, promptInput, setPromptInput, submitPrompt, activeSectionId } =
    useWizardContext();

  const isGenerating = Object.values(sectionStatuses).some((status) => status === "generating");
  const hasGeneratedDetails = Object.keys(outputs).length > 0;
  const isRefining = hasGeneratedDetails && Boolean(activeSectionId);
  const promptPlaceholder = isRefining
    ? "Refine your fighter..."
    : "Describe your fighter. Role, personality, visual vibe...";

  const handlePromptSubmit = useCallback(() => {
    void submitPrompt();
  }, [submitPrompt]);

  return (
    <div className="pointer-events-auto absolute top-[5px] right-0 left-0 z-20 flex justify-center px-4">
      <div className="w-full max-w-[652px] p-2.5">
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Textarea
              autoFocus={autoFocus}
              className="h-[116px] w-full resize-y border-none! bg-background text-sm focus-visible:border-none! focus-visible:ring-0!"
              disabled={isGenerating}
              onChange={(event) => setPromptInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey) {
                  return;
                }
                event.preventDefault();
                handlePromptSubmit();
              }}
              placeholder={promptPlaceholder}
              value={promptInput}
            />
            <div className="absolute right-[-40px] bottom-[2px]">
              <Button
                className="size-9 rounded-full p-0"
                disabled={isGenerating}
                onClick={handlePromptSubmit}
                size="sm"
                type="button"
              >
                <SendHorizontal className="size-4" />
                <span className="sr-only">Submit prompt</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
