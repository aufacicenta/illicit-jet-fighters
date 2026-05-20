import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { useWizardContext } from "../../../context/Wizard/useWizardContext";
import { SectionStatusBadge, wizardCardHeaderClassName } from "./SectionStatusBadge";
import { WizardCardTitle } from "./WizardCardTitle";

export const StrikecraftSpriteSection = () => {
  const { outputs, sectionStatuses, activeSectionId, setActiveSection } = useWizardContext();
  const imageOutput = outputs["strikecraft-sprite-image"];
  const imageStatus = sectionStatuses["strikecraft-sprite-image"];

  return (
    <Card
      className={activeSectionId === "strikecraft-sprite-image" ? "border-secondary" : undefined}
      onClick={() => setActiveSection("strikecraft-sprite-image")}
    >
      <CardHeader
        className={`flex flex-row items-center justify-between gap-2 ${wizardCardHeaderClassName}`}
      >
        <WizardCardTitle>Strikecraft Top Sprite</WizardCardTitle>
        <SectionStatusBadge status={imageStatus} />
      </CardHeader>
      <CardContent className="space-y-3">
        {imageStatus === "generating" ? (
          <div className="space-y-2">
            <Skeleton className="h-[220px] w-full" />
            <Skeleton className="h-4 w-4/12" />
          </div>
        ) : imageOutput ? (
          <img
            alt="Generated strikecraft top sprite"
            className="max-h-[360px] w-full rounded-sm border border-border bg-background object-contain"
            src={imageOutput.assetUrl ?? imageOutput.content}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Strikecraft top-down sprite will appear here after continuation starts.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
