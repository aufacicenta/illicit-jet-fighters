import { SendHorizontal } from "lucide-react";
import { useCallback, useContext } from "react";

import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { WizardContext } from "../../context/Wizard/WizardContext";

type PromptBarProps = {
  autoFocus?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  placeholder?: string;
};

export const PromptBar = ({
  autoFocus,
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
}: PromptBarProps) => {
  const wizardContext = useContext(WizardContext);
  const isGeneratingFromWizard = wizardContext
    ? Object.values(wizardContext.sectionStatuses).some((status) => status === "generating")
    : false;
  const hasGeneratedDetails = wizardContext ? Object.keys(wizardContext.outputs).length > 0 : false;
  const isRefining = wizardContext
    ? hasGeneratedDetails && Boolean(wizardContext.activeSectionId)
    : false;
  const promptPlaceholder =
    placeholder ??
    (isRefining
      ? "Refine your fighter..."
      : "Describe your fighter. Role, personality, visual vibe...");
  const promptValue = value ?? wizardContext?.promptInput ?? "";
  const isDisabled = disabled ?? isGeneratingFromWizard;

  const handlePromptSubmit = useCallback(() => {
    if (onSubmit) {
      onSubmit();
      return;
    }
    if (wizardContext) {
      void wizardContext.submitPrompt();
    }
  }, [onSubmit, wizardContext]);

  return (
    <div className="pointer-events-auto flex justify-center px-4 w-full">
      <div className="w-full max-w-[652px] p-2.5">
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Textarea
              autoFocus={autoFocus}
              className="h-[116px] w-full resize-y border-none! bg-transparent text-sm focus-visible:border-none! focus-visible:ring-0!"
              disabled={isDisabled}
              onChange={(event) => {
                if (onChange) {
                  onChange(event.target.value);
                  return;
                }
                wizardContext?.setPromptInput(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey) {
                  return;
                }
                event.preventDefault();
                handlePromptSubmit();
              }}
              placeholder={promptPlaceholder}
              value={promptValue}
            />
            <div className="absolute right-[-40px] bottom-[2px]">
              <Button
                className="size-9 rounded-full p-0"
                disabled={isDisabled}
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
