import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { useWizardContext } from "../../../context/Wizard/useWizardContext";
import { SectionStatusBadge, wizardCardHeaderClassName } from "./SectionStatusBadge";
import { WizardCardTitle } from "./WizardCardTitle";

export const SpritesheetSection = () => {
  const {
    outputs,
    sectionStatuses,
    activeSectionId,
    setActiveSection,
    requestRegenerateSpritesheetImage,
    errorMessage,
  } = useWizardContext();
  const imageOutput = outputs["spritesheet-image"];
  const imageStatus = sectionStatuses["spritesheet-image"];
  const hasSpritesheetPrompt = Boolean(outputs["spritesheet-prompt"]?.content);
  const isRetryDisabled =
    imageStatus === "locked" || imageStatus === "generating" || !hasSpritesheetPrompt;
  const actionLabel = imageStatus === "error" ? "Retry" : "Regenerate";

  return (
    <Card
      className={activeSectionId === "spritesheet-image" ? "border-secondary" : undefined}
      onClick={() => setActiveSection("spritesheet-image")}
    >
      <CardHeader
        className={`flex flex-row items-center justify-between gap-2 ${wizardCardHeaderClassName}`}
      >
        <WizardCardTitle>Character Spritesheet</WizardCardTitle>
        <div className="flex items-center gap-2">
          <Button
            disabled={isRetryDisabled}
            onClick={(event) => {
              event.stopPropagation();
              void requestRegenerateSpritesheetImage();
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            {imageStatus === "generating" ? "Regenerating..." : actionLabel}
          </Button>
          <SectionStatusBadge status={imageStatus} />
        </div>
      </CardHeader>
      <CardContent>
        {imageStatus === "generating" ? (
          <div className="space-y-2">
            <Skeleton className="h-[280px] w-full" />
          </div>
        ) : imageOutput ? (
          <div
            aria-label="Generated character spritesheet"
            className="min-h-[116px] w-full rounded-sm border border-border bg-background bg-contain bg-center bg-no-repeat"
            role="img"
            style={{
              backgroundImage: `url(${imageOutput.assetUrl ?? imageOutput.content})`,
            }}
          />
        ) : imageStatus === "error" ? (
          <div className="rounded-sm border border-destructive/70 bg-destructive/10 p-3 text-sm text-foreground">
            {errorMessage ?? "Character spritesheet generation failed. Retry to generate again."}
          </div>
        ) : (
          <p className="p-3 text-sm text-muted-foreground">
            Character spritesheet will appear here after continuation starts.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
