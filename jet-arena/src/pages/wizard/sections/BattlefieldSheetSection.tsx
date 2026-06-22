import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { useBattlefieldWizardContext } from "../../../context/BattlefieldWizard/useBattlefieldWizardContext";
import { BattlefieldSectionCostBadge } from "./BattlefieldSectionCostBadge";
import {
  BattlefieldSectionStatusBadge,
  resolveBattlefieldSectionStatus,
  wizardCardHeaderClassName,
} from "./BattlefieldSectionStatusBadge";
import { WizardCardTitle } from "./WizardCardTitle";

export const BattlefieldSheetSection = () => {
  const { outputs, sectionStatuses, activeSectionId, setActiveSection, requestRegenerateSheet } =
    useBattlefieldWizardContext();

  const promptStatus = sectionStatuses["battlefield-sheet-prompt"];
  const imageStatus = sectionStatuses["battlefield-sheet-image"];
  const imageOutput = outputs["battlefield-sheet-image"];
  const isGenerating = promptStatus === "generating" || imageStatus === "generating";
  const hasDescription = Boolean(outputs["battlefield-description"]?.content);
  const isRegenerateDisabled = isGenerating || !hasDescription;
  const actionLabel = imageStatus === "error" || promptStatus === "error" ? "Retry" : "Regenerate";
  const headerStatus = resolveBattlefieldSectionStatus([promptStatus, imageStatus]);

  return (
    <Card
      className={activeSectionId === "battlefield-sheet-image" ? "border-secondary" : undefined}
      onClick={() => setActiveSection("battlefield-sheet-image")}
    >
      <CardHeader className={`space-y-2 ${wizardCardHeaderClassName}`}>
        <div className="flex items-center justify-between gap-2">
          <WizardCardTitle>Battlefield Sheet</WizardCardTitle>
          <div className="flex items-center gap-2">
            <Button
              disabled={isRegenerateDisabled}
              onClick={(event) => {
                event.stopPropagation();
                void requestRegenerateSheet();
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              {isGenerating ? "Regenerating..." : actionLabel}
            </Button>
            <BattlefieldSectionCostBadge
              sectionIds={["battlefield-sheet-prompt", "battlefield-sheet-image"]}
            />
            <BattlefieldSectionStatusBadge status={headerStatus} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isGenerating ? (
          <div className="space-y-2">
            <Skeleton className="h-[420px] w-full" />
          </div>
        ) : imageOutput ? (
          <img
            alt="Generated battlefield sheet"
            className="max-h-[700px] w-full rounded-sm border border-border bg-background object-contain"
            src={imageOutput.assetUrl ?? imageOutput.content}
          />
        ) : (
          <p className="p-3 text-sm text-muted-foreground">
            Battlefield reference sheet image appears after generation.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
