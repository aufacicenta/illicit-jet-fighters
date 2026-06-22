import { Badge } from "../../../components/ui/badge";
import { useBattlefieldCostsContext } from "../../../context/BattlefieldCosts/useBattlefieldCostsContext";
import type { BattlefieldSectionId } from "../../../context/BattlefieldWizard/BattlefieldWizardContext.types";

type BattlefieldSectionCostBadgeProps = {
  sectionIds: BattlefieldSectionId[];
};

export const BattlefieldSectionCostBadge = ({ sectionIds }: BattlefieldSectionCostBadgeProps) => {
  const { formatUsd, getSectionLatestRunCostUsd, isLoading } = useBattlefieldCostsContext();
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
