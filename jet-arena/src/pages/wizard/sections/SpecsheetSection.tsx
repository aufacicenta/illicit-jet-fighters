import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { useWizardContext } from "../../../context/Wizard/useWizardContext";
import { SectionCostBadge } from "./SectionCostBadge";
import {
  resolveSectionStatus,
  SectionStatusBadge,
  wizardCardHeaderClassName,
} from "./SectionStatusBadge";
import { WizardCardTitle } from "./WizardCardTitle";

export const SpecsheetSection = () => {
  const {
    outputs,
    sectionStatuses,
    activeSectionId,
    setActiveSection,
    requestRegenerateSpecsheet,
  } = useWizardContext();

  const imageOutput = outputs["specsheet-image"];
  const imageStatus = sectionStatuses["specsheet-image"];
  const promptStatus = sectionStatuses["specsheet-prompt"];
  const hasCharacterDescription = Boolean(outputs["character-description"]?.content);
  const isGeneratingSpecsheet = imageStatus === "generating" || promptStatus === "generating";
  const isRetryDisabled =
    promptStatus === "locked" ||
    imageStatus === "locked" ||
    isGeneratingSpecsheet ||
    !hasCharacterDescription;
  const actionLabel = imageStatus === "error" || promptStatus === "error" ? "Retry" : "Regenerate";
  const headerStatus = resolveSectionStatus([promptStatus, imageStatus]);
  return (
    <Card
      className={activeSectionId === "specsheet-image" ? "border-secondary" : undefined}
      onClick={() => setActiveSection("specsheet-image")}
    >
      <CardHeader className={`space-y-2 ${wizardCardHeaderClassName}`}>
        <div className="flex items-center justify-between gap-2">
          <WizardCardTitle>Pilot Specsheet</WizardCardTitle>
          <div className="flex items-center gap-2">
            <Button
              disabled={isRetryDisabled}
              onClick={(event) => {
                event.stopPropagation();
                void requestRegenerateSpecsheet();
              }}
              size="xs"
              color="muted"
              type="button"
              variant="ghost"
            >
              {isGeneratingSpecsheet ? "Regenerating..." : actionLabel}
            </Button>
            <SectionCostBadge sectionIds={["specsheet-prompt", "specsheet-image"]} />
            <SectionStatusBadge status={headerStatus} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isGeneratingSpecsheet ? (
          <div className="space-y-2">
            <Skeleton className="h-[420px] w-full" />
          </div>
        ) : imageOutput ? (
          <img
            alt="Generated specsheet"
            className="max-h-[700px] w-full rounded-sm border border-border bg-background object-contain"
            src={imageOutput.assetUrl ?? imageOutput.content}
          />
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            Specsheet image will appear here after generation.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
