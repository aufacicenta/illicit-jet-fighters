import type { SectionId, SectionStatus } from "../../context/Wizard/WizardContext.types";

const sections: Array<{ id: SectionId; label: string }> = [
  { id: "character-description", label: "briefing" },
  { id: "specsheet-prompt", label: "targeting" },
  { id: "specsheet-image", label: "render" },
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
    <div className="mt-4 grid grid-cols-3 gap-3">
      {sections.map((section) => (
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
);
