import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { useWizardContext } from "../../../context/Wizard/useWizardContext";
import { SectionStatusBadge, wizardCardHeaderClassName } from "./SectionStatusBadge";
import { WizardCardTitle } from "./WizardCardTitle";

export const SpritesheetSection = () => {
  const { outputs, sectionStatuses, activeSectionId, setActiveSection } = useWizardContext();
  const imageOutput = outputs["spritesheet-image"];
  const imageStatus = sectionStatuses["spritesheet-image"];

  return (
    <Card
      className={activeSectionId === "spritesheet-image" ? "border-secondary" : undefined}
      onClick={() => setActiveSection("spritesheet-image")}
    >
      <CardHeader
        className={`flex flex-row items-center justify-between gap-2 ${wizardCardHeaderClassName}`}
      >
        <WizardCardTitle>Character Spritesheet</WizardCardTitle>
        <SectionStatusBadge status={imageStatus} />
      </CardHeader>
      <CardContent className="space-y-3">
        {imageStatus === "generating" ? (
          <div className="space-y-2">
            <Skeleton className="h-[280px] w-full" />
            <Skeleton className="h-4 w-3/12" />
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
        ) : (
          <p className="text-sm text-muted-foreground">
            Character spritesheet will appear here after continuation starts.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
