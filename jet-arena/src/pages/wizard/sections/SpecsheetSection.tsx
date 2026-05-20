import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { useWizardContext } from "../../../context/Wizard/useWizardContext";
import {
  resolveSectionStatus,
  SectionStatusBadge,
  wizardCardHeaderClassName,
} from "./SectionStatusBadge";
import { WizardCardTitle } from "./WizardCardTitle";

export const SpecsheetSection = () => {
  const { outputs, sectionStatuses, activeSectionId, setActiveSection } = useWizardContext();

  const imageOutput = outputs["specsheet-image"];
  const imageStatus = sectionStatuses["specsheet-image"];
  const promptStatus = sectionStatuses["specsheet-prompt"];
  const isGeneratingSpecsheet = imageStatus === "generating" || promptStatus === "generating";
  const headerStatus = resolveSectionStatus([promptStatus, imageStatus]);
  return (
    <Card
      className={activeSectionId === "specsheet-image" ? "border-secondary" : undefined}
      onClick={() => setActiveSection("specsheet-image")}
    >
      <CardHeader className={`space-y-2 ${wizardCardHeaderClassName}`}>
        <div className="flex items-center justify-between gap-2">
          <WizardCardTitle>Pilot Specsheet</WizardCardTitle>
          <SectionStatusBadge status={headerStatus} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isGeneratingSpecsheet ? (
          <div className="space-y-2">
            <Skeleton className="h-[420px] w-full" />
            <Skeleton className="h-4 w-4/12" />
          </div>
        ) : imageOutput ? (
          <img
            alt="Generated specsheet"
            className="max-h-[700px] w-full rounded-sm border border-border bg-background object-contain"
            src={imageOutput.assetUrl ?? imageOutput.content}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Specsheet image will appear here after generation.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
