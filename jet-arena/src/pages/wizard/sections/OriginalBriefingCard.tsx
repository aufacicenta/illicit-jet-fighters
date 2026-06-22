import { Send } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Textarea } from "../../../components/ui/textarea";
import { useWizardContext } from "../../../context/Wizard/useWizardContext";
import { wizardCardHeaderClassName } from "./SectionStatusBadge";
import { WizardCardTitle } from "./WizardCardTitle";

const originalBriefingContentClassName =
  "max-h-[260px] overflow-auto rounded-sm border border-primary/40 bg-primary/5 p-4 text-base leading-relaxed";

type OriginalBriefingCardProps = {
  originalBriefing: string | null;
};

export const OriginalBriefingCard = ({ originalBriefing }: OriginalBriefingCardProps) => {
  const { resubmitBriefing, sectionStatuses } = useWizardContext();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(originalBriefing ?? "");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasGeneratingSection = Object.values(sectionStatuses).some(
    (status) => status === "generating",
  );
  const trimmedDraft = draft.trim();
  const trimmedOriginal = originalBriefing?.trim() ?? "";
  const hasChanges = trimmedDraft !== trimmedOriginal;
  const canEdit = Boolean(trimmedOriginal) && !hasGeneratingSection && !isSubmitting;

  useEffect(() => {
    if (!isEditing) {
      setDraft(originalBriefing ?? "");
    }
  }, [isEditing, originalBriefing]);

  const handleCancelEdit = () => {
    setIsEditing(false);
    setDraft(originalBriefing ?? "");
  };

  const handleConfirmResubmit = async () => {
    setConfirmOpen(false);
    setIsSubmitting(true);
    setIsEditing(false);

    try {
      await resubmitBriefing(trimmedDraft);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader
        className={`flex flex-row items-center justify-between gap-2 ${wizardCardHeaderClassName}`}
      >
        <WizardCardTitle>Original Briefing</WizardCardTitle>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Button
              color="muted"
              disabled={isSubmitting}
              onClick={handleCancelEdit}
              size="xs"
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              disabled={!trimmedDraft || !hasChanges || isSubmitting}
              onClick={() => setConfirmOpen(true)}
              size="xs"
              type="button"
            >
              <Send className="size-3.5" />
              Send
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <Textarea
            autoFocus
            className={`${originalBriefingContentClassName} min-h-[160px] resize-y whitespace-pre-wrap`}
            disabled={isSubmitting}
            onChange={(event) => setDraft(event.target.value)}
            value={draft}
          />
        ) : (
          <pre
            className={`${originalBriefingContentClassName} whitespace-pre-wrap ${canEdit ? "cursor-text" : ""}`}
            onClick={() => {
              if (canEdit) {
                setIsEditing(true);
              }
            }}
          >
            {trimmedOriginal || "No original briefing yet. Submit intake to create one."}
          </pre>
        )}
      </CardContent>

      <Dialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate fighter?</DialogTitle>
            <DialogDescription>
              Resubmitting the briefing will regenerate every other section - full briefing, pilot
              specsheet, profile picture, character spritesheet, agent source, and strikecraft
              assets. Current outputs will be replaced.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button color="muted" type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button
              disabled={isSubmitting}
              onClick={() => void handleConfirmResubmit()}
              type="button"
            >
              Regenerate everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
