import { Badge } from "../../../components/ui/badge";
import type { BattlefieldSectionStatus } from "../../../context/BattlefieldWizard/BattlefieldWizardContext.types";

export const wizardCardHeaderClassName = "border-b border-border/70 px-5 py-2.5";

const sectionStatusLabelMap: Record<BattlefieldSectionStatus, string> = {
  locked: "Locked",
  ready: "Pending",
  generating: "Generating",
  complete: "Done",
  error: "Error",
  blocked: "Blocked",
};

const sectionStatusClassNameMap: Record<BattlefieldSectionStatus, string> = {
  locked: "border-border/60 bg-muted text-muted-foreground",
  ready: "border-secondary/70 bg-secondary/20 text-secondary",
  generating: "border-accent/80 bg-accent/20 text-accent animate-pulse",
  complete: "border-secondary/80 bg-secondary/20 text-secondary",
  error: "border-destructive/80 bg-destructive/20 text-destructive",
  blocked: "border-amber-500/80 bg-amber-500/20 text-amber-200",
};

export const resolveBattlefieldSectionStatus = (
  statuses: BattlefieldSectionStatus[],
): BattlefieldSectionStatus => {
  if (statuses.some((status) => status === "error")) {
    return "error";
  }
  if (statuses.some((status) => status === "blocked")) {
    return "blocked";
  }
  if (statuses.some((status) => status === "generating")) {
    return "generating";
  }
  if (statuses.some((status) => status === "complete")) {
    return "complete";
  }
  if (statuses.some((status) => status === "ready")) {
    return "ready";
  }
  return "locked";
};

export const BattlefieldSectionStatusBadge = ({ status }: { status: BattlefieldSectionStatus }) => (
  <Badge className={sectionStatusClassNameMap[status]} variant="secondary">
    {sectionStatusLabelMap[status]}
  </Badge>
);
