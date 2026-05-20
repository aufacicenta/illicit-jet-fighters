import { Button } from "../../components/ui/button";
import type { SectionId, SectionStatus } from "../../context/Wizard/WizardContext.types";

const phaseOneSections: Array<{ id: SectionId; label: string }> = [
  { id: "character-description", label: "briefing" },
  { id: "specsheet-prompt", label: "targeting" },
  { id: "specsheet-image", label: "render" },
];

const phaseTwoSections: Array<{ id: SectionId; label: string }> = [
  { id: "spritesheet-prompt", label: "sprite brief" },
  { id: "spritesheet-image", label: "sprite render" },
  { id: "agent-code", label: "agent code" },
  { id: "strikecraft-specsheet-prompt", label: "craft brief" },
  { id: "strikecraft-specsheet-image", label: "craft render" },
  { id: "strikecraft-sprite-prompt", label: "craft top brief" },
  { id: "strikecraft-sprite-image", label: "craft top render" },
];

const getCompletedCount = (
  sections: Array<{ id: SectionId; label: string }>,
  sectionStatuses: Record<SectionId, SectionStatus>,
) => sections.filter((section) => sectionStatuses[section.id] === "complete").length;

const getStepClassName = (status: SectionStatus) => {
  if (status === "complete") {
    return "border-primary bg-primary";
  }
  if (status === "generating") {
    return "border-accent bg-accent animate-pulse";
  }
  if (status === "error") {
    return "border-destructive bg-destructive";
  }
  return "border-border bg-muted";
};

export const ProgressHud = ({
  sectionStatuses,
  gateMessage,
  onContinuePhaseOne,
  onContinuePhaseTwo,
}: {
  sectionStatuses: Record<SectionId, SectionStatus>;
  gateMessage: string | null;
  onContinuePhaseOne: () => void;
  onContinuePhaseTwo: () => void;
}) => {
  const phaseOneCompleted = getCompletedCount(phaseOneSections, sectionStatuses);
  const phaseTwoCompleted = getCompletedCount(phaseTwoSections, sectionStatuses);
  const phaseTwoUnlocked = phaseTwoSections.some(
    (section) => sectionStatuses[section.id] !== "locked",
  );

  return (
    <div className="space-y-2">
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
        pilot intake progress
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-sm border border-border/70 bg-card/60 p-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
              Phase 1 · {phaseOneCompleted}/{phaseOneSections.length}
            </p>
            <Button
              className="h-7 px-2.5 text-[10px] tracking-wide uppercase"
              disabled={!gateMessage}
              onClick={onContinuePhaseOne}
              size="sm"
              type="button"
              variant={gateMessage ? "default" : "outline"}
            >
              Continue
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {phaseOneSections.map((section) => (
              <div
                key={section.id}
                className={`h-1.5 rounded-sm border ${getStepClassName(sectionStatuses[section.id])}`}
                title={`Phase 1: ${section.label}`}
              />
            ))}
          </div>
        </div>

        <div className="rounded-sm border border-border/70 bg-card/60 p-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
              Phase 2 · {phaseTwoCompleted}/{phaseTwoSections.length}
            </p>
            <Button
              className="h-7 px-2.5 text-[10px] tracking-wide uppercase"
              disabled={!phaseTwoUnlocked}
              onClick={onContinuePhaseTwo}
              size="sm"
              type="button"
              variant={phaseTwoUnlocked ? "default" : "outline"}
            >
              Continue
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {phaseTwoSections.map((section) => (
              <div
                key={section.id}
                className={`h-1.5 rounded-sm border ${getStepClassName(sectionStatuses[section.id])}`}
                title={`Phase 2: ${section.label}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
