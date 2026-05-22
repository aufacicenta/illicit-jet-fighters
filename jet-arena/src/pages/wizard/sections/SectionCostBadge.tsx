import { Badge } from "../../../components/ui/badge";
import { useCostsContext } from "../../../context/Costs/useCostsContext";
import type { SectionId } from "../../../context/Wizard/WizardContext.types";

type SectionCostBadgeProps = {
  sectionIds: SectionId[];
};

export const SectionCostBadge = ({ sectionIds }: SectionCostBadgeProps) => {
  const { formatUsd, getSectionLatestRunCostUsd, isLoading } = useCostsContext();
  const totalSectionCost = sectionIds.reduce((sum, sectionId) => {
    const sectionCost = Number.parseFloat(getSectionLatestRunCostUsd(sectionId));
    return Number.isFinite(sectionCost) ? sum + sectionCost : sum;
  }, 0);

  return (
    <Badge
      className={
        totalSectionCost > 0
          ? "border-primary/70 bg-primary/15 text-primary"
          : "border-border/70 bg-muted text-muted-foreground"
      }
      variant="secondary"
    >
      {isLoading ? "..." : formatUsd(totalSectionCost)}
    </Badge>
  );
};
