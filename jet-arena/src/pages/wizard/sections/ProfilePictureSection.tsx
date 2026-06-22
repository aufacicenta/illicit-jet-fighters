import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { useWizardContext } from "../../../context/Wizard/useWizardContext";
import { SectionCostBadge } from "./SectionCostBadge";
import {
  resolveSectionStatus,
  SectionStatusBadge,
  wizardCardHeaderClassName,
} from "./SectionStatusBadge";
import { WizardCardTitle } from "./WizardCardTitle";

export const ProfilePictureSection = () => {
  const {
    outputs,
    sectionStatuses,
    activeSectionId,
    setActiveSection,
    requestRegenerateCharacterPfp,
  } = useWizardContext();

  const imageOutput = outputs["character-pfp-image"];
  const imageStatus = sectionStatuses["character-pfp-image"];
  const promptStatus = sectionStatuses["character-pfp-prompt"];
  const hasCharacterDescription = Boolean(outputs["character-description"]?.content);
  const isGeneratingProfilePicture = imageStatus === "generating" || promptStatus === "generating";
  const isRetryDisabled = isGeneratingProfilePicture || !hasCharacterDescription;
  const actionLabel = imageStatus === "error" || promptStatus === "error" ? "Retry" : "Regenerate";
  const headerStatus = resolveSectionStatus([promptStatus, imageStatus]);

  return (
    <Card
      className={activeSectionId === "character-pfp-image" ? "border-secondary" : undefined}
      onClick={() => setActiveSection("character-pfp-image")}
    >
      <CardHeader className={`space-y-2 ${wizardCardHeaderClassName}`}>
        <div>
          <WizardCardTitle>Profile Picture</WizardCardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isGeneratingProfilePicture ? (
          <div className="space-y-2">
            <Skeleton className="mx-auto aspect-square w-full max-w-[320px]" />
          </div>
        ) : imageOutput ? (
          <img
            alt="Generated profile picture"
            className="mx-auto aspect-square w-full max-w-[320px] rounded-sm border border-border bg-background object-contain"
            src={imageOutput.assetUrl ?? imageOutput.content}
          />
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            Profile picture will appear here after generation.
          </p>
        )}
      </CardContent>
      <CardFooter className="justify-between p-2">
        <Button
          disabled={isRetryDisabled}
          onClick={(event) => {
            event.stopPropagation();
            void requestRegenerateCharacterPfp();
          }}
          size="xs"
          color="muted"
          type="button"
          variant="ghost"
        >
          {isGeneratingProfilePicture ? "Regenerating..." : actionLabel}
        </Button>
        <div className="flex gap-2 justify-self-end">
          {isGeneratingProfilePicture ? null : (
            <SectionCostBadge sectionIds={["character-pfp-prompt", "character-pfp-image"]} />
          )}
          <SectionStatusBadge status={headerStatus} />
        </div>
      </CardFooter>
    </Card>
  );
};
