import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { useWizardContext } from "../../../context/Wizard/useWizardContext";
import { SectionStatusBadge, wizardCardHeaderClassName } from "./SectionStatusBadge";
import { WizardCardTitle } from "./WizardCardTitle";

export const StrikecraftSpecsheetSection = () => {
  const { outputs, sectionStatuses, activeSectionId, setActiveSection } = useWizardContext();
  const imageOutput = outputs["strikecraft-specsheet-image"];
  const imageStatus = sectionStatuses["strikecraft-specsheet-image"];

  return (
    <Card
      className={activeSectionId === "strikecraft-specsheet-image" ? "border-secondary" : undefined}
      onClick={() => setActiveSection("strikecraft-specsheet-image")}
    >
      <CardHeader
        className={`flex flex-row items-center justify-between gap-2 ${wizardCardHeaderClassName}`}
      >
        <WizardCardTitle>Strikecraft Specsheet</WizardCardTitle>
        <SectionStatusBadge status={imageStatus} />
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
