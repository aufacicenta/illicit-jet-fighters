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
}: {
  sectionStatuses: Record<SectionId, SectionStatus>;
}) => (
  <div className="rounded-sm border border-border bg-card p-4">
    <p className="text-xs tracking-widest text-muted-foreground uppercase">pilot intake progress</p>
    <div className="mt-4 space-y-4">
      <div className="space-y-2">
        <p className="text-[10px] tracking-widest text-muted-foreground uppercase">phase 1</p>
        <div className="grid grid-cols-3 gap-3">
          {phaseOneSections.map((section) => (
            <div key={section.id} className="space-y-2">
              <div
                className={`h-1.5 w-full rounded-sm border ${getStepClassName(sectionStatuses[section.id])}`}
              />
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                {section.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-[10px] tracking-widest text-muted-foreground uppercase">phase 2</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {phaseTwoSections.map((section) => (
            <div key={section.id} className="space-y-2">
              <div
                className={`h-1.5 w-full rounded-sm border ${getStepClassName(sectionStatuses[section.id])}`}
              />
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                {section.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
