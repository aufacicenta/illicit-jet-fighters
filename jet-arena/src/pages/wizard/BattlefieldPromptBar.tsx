import { SendHorizontal } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { useBattlefieldWizardContext } from "../../context/BattlefieldWizard/useBattlefieldWizardContext";

const sectionLabels = {
  "battlefield-description": "Battlefield Description",
  "battlefield-sheet-prompt": "Battlefield Sheet Prompt",
  "battlefield-sheet-image": "Battlefield Sheet Render",
  "battlefield-config": "Battlefield Config",
} as const;

type PromptBarMode = "briefing" | "docked";

export const BattlefieldPromptBar = ({
  mode,
  disabled,
  autoFocus,
}: {
  mode: PromptBarMode;
  disabled?: boolean;
  autoFocus?: boolean;
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const {
    activeSectionId,
    outputs,
    gateMessage,
    promptInput,
    setPromptInput,
    submitPrompt,
    requestContinuePipeline,
  } = useBattlefieldWizardContext();
  const isBriefing = mode === "briefing";
  const hasGeneratedDetails = Object.keys(outputs).length > 0;
  const isRefining = hasGeneratedDetails && Boolean(activeSectionId);
  const placeholder = isRefining
    ? "Restart from a revised battlefield briefing..."
    : "Describe your battlefield. Terrain, hazards, tactical mood...";

  useEffect(() => {
    if (autoFocus) {
      textareaRef.current?.focus();
    }
  }, [autoFocus]);

  return (
    <div
      className={
        isBriefing
          ? "mx-auto w-full max-w-2xl rounded-sm border border-border bg-card/95 p-6"
          : "w-full rounded-sm border border-border bg-card/95 p-4"
      }
    >
      <div className="flex flex-col gap-3">
        {gateMessage ? (
          <div className="flex items-center justify-between gap-3 rounded-sm border border-secondary/40 bg-muted/40 p-3 text-xs tracking-wide text-foreground uppercase">
            <span>{gateMessage}</span>
            <Button size="sm" onClick={requestContinuePipeline}>
              Continue
            </Button>
          </div>
        ) : null}

        <div className="text-xs tracking-widest text-muted-foreground uppercase">
          {isRefining && activeSectionId ? (
            <>
              Active: <span className="text-foreground">{sectionLabels[activeSectionId]}</span>
            </>
          ) : null}
        </div>

        {isBriefing ? (
          <>
            <Textarea
              ref={textareaRef}
              className="min-h-36 text-sm"
              onChange={(event) => setPromptInput(event.target.value)}
              placeholder={placeholder}
              value={promptInput}
              disabled={disabled}
            />
            <Button
              className="h-11 w-full"
              onClick={() => {
                void submitPrompt();
              }}
              type="button"
              disabled={disabled}
            >
              <SendHorizontal className="size-4" />
              Initiate
            </Button>
          </>
        ) : (
          <div className="relative">
            <Textarea
              className="min-h-24 w-full pr-16 text-sm"
              onChange={(event) => setPromptInput(event.target.value)}
              placeholder={placeholder}
              value={promptInput}
              disabled={disabled}
            />
            <div className="absolute right-2 bottom-2">
              <Button
                className="h-10 px-3"
                size="sm"
                onClick={() => {
                  void submitPrompt();
                }}
                type="button"
                disabled={disabled}
              >
                <SendHorizontal className="size-4" />
                Send
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
