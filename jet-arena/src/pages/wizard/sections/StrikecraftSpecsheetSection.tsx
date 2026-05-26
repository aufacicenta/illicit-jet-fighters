import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { useWizardContext } from "../../../context/Wizard/useWizardContext";
import { SectionCostBadge } from "./SectionCostBadge";
import { SectionStatusBadge, wizardCardHeaderClassName } from "./SectionStatusBadge";
import { WizardCardTitle } from "./WizardCardTitle";

export const StrikecraftSpecsheetSection = () => {
  const {
    outputs,
    sectionStatuses,
    activeSectionId,
    setActiveSection,
    requestRegenerateStrikecraftSpecsheetImage,
  } = useWizardContext();
  const imageOutput = outputs["strikecraft-specsheet-image"];
  const imageStatus = sectionStatuses["strikecraft-specsheet-image"];
  const hasStrikecraftSpecsheetPrompt = Boolean(outputs["strikecraft-specsheet-prompt"]?.content);
  const isRetryDisabled =
    imageStatus === "locked" || imageStatus === "generating" || !hasStrikecraftSpecsheetPrompt;
  const actionLabel = imageStatus === "error" ? "Retry" : "Regenerate";

  return (
    <Card
      className={activeSectionId === "strikecraft-specsheet-image" ? "border-secondary" : undefined}
      onClick={() => setActiveSection("strikecraft-specsheet-image")}
    >
      <CardHeader
        className={`flex flex-row items-center justify-between gap-2 ${wizardCardHeaderClassName}`}
      >
        <WizardCardTitle>Strikecraft Specsheet</WizardCardTitle>
        <div className="flex items-center gap-2">
          <Button
            disabled={isRetryDisabled}
            onClick={(event) => {
              event.stopPropagation();
              void requestRegenerateStrikecraftSpecsheetImage();
            }}
            size="xs"
            color="muted"
            type="button"
            variant="ghost"
          >
            {imageStatus === "generating" ? "Regenerating..." : actionLabel}
          </Button>
          <SectionCostBadge
            sectionIds={["strikecraft-specsheet-prompt", "strikecraft-specsheet-image"]}
          />
          <SectionStatusBadge status={imageStatus} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {imageStatus === "generating" ? (
          <div className="space-y-2">
            <Skeleton className="h-[420px] w-full" />
            <Skeleton className="h-4 w-4/12" />
          </div>
        ) : imageOutput ? (
          <img
            alt="Generated strikecraft specsheet"
            className="max-h-[700px] w-full rounded-sm border border-border bg-background object-contain"
            src={imageOutput.assetUrl ?? imageOutput.content}
          />
        ) : (
          <p className="p-3 text-sm text-muted-foreground">
            Strikecraft specsheet image will appear here after continuation starts.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
