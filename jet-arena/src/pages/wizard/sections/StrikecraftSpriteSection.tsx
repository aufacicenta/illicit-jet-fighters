import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { useWizardContext } from "../../../context/Wizard/useWizardContext";
import { SectionCostBadge } from "./SectionCostBadge";
import { SectionStatusBadge, wizardCardHeaderClassName } from "./SectionStatusBadge";
import { WizardCardTitle } from "./WizardCardTitle";

export const StrikecraftSpriteSection = () => {
  const {
    outputs,
    sectionStatuses,
    activeSectionId,
    setActiveSection,
    requestRegenerateStrikecraftSpriteImage,
    errorMessage,
  } = useWizardContext();
  const imageOutput = outputs["strikecraft-sprite-image"];
  const imageStatus = sectionStatuses["strikecraft-sprite-image"];
  const hasStrikecraftSpritePrompt = Boolean(outputs["strikecraft-sprite-prompt"]?.content);
  const hasStrikecraftSpecsheetPrompt = Boolean(outputs["strikecraft-specsheet-prompt"]?.content);
  const hasCharacterDescription = Boolean(outputs["character-description"]?.content);
  const canRegenerate =
    hasStrikecraftSpritePrompt || hasStrikecraftSpecsheetPrompt || hasCharacterDescription;
  const isRetryDisabled =
    imageStatus === "locked" || imageStatus === "generating" || !canRegenerate;
  const actionLabel = imageStatus === "error" ? "Retry" : "Regenerate";

  return (
    <Card
      className={activeSectionId === "strikecraft-sprite-image" ? "border-secondary" : undefined}
      onClick={() => setActiveSection("strikecraft-sprite-image")}
    >
      <CardHeader
        className={`flex flex-row items-center justify-between gap-2 ${wizardCardHeaderClassName}`}
      >
        <WizardCardTitle>Strikecraft Top Sprite</WizardCardTitle>
        <div className="flex items-center gap-2">
          <Button
            disabled={isRetryDisabled}
            onClick={(event) => {
              event.stopPropagation();
              void requestRegenerateStrikecraftSpriteImage();
            }}
            size="xs"
            color="muted"
            type="button"
            variant="ghost"
          >
            {imageStatus === "generating" ? "Regenerating..." : actionLabel}
          </Button>
          <SectionCostBadge
            sectionIds={["strikecraft-sprite-prompt", "strikecraft-sprite-image"]}
          />
          <SectionStatusBadge status={imageStatus} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {imageStatus === "generating" ? (
          <div className="space-y-2">
            <Skeleton className="h-[220px] w-full" />
          </div>
        ) : imageOutput ? (
          <img
            alt="Generated strikecraft top sprite"
            className="max-h-[360px] w-full rounded-sm border border-border bg-background object-contain"
            src={imageOutput.assetUrl ?? imageOutput.content}
          />
        ) : imageStatus === "error" ? (
          <div className="rounded-sm border border-destructive/70 bg-destructive/10 p-3 text-sm text-foreground">
            {errorMessage ?? "Strikecraft sprite generation failed. Retry to generate again."}
          </div>
        ) : (
          <p className="p-3 text-sm text-muted-foreground">
            Strikecraft top-down sprite will appear here after continuation starts.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
