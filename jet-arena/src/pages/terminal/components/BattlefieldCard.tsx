import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import type { BattlefieldListItem } from "../../../lib/api/types";
import { cn } from "../../../lib/utils";
import { WizardCardTitle } from "../../wizard/sections/WizardCardTitle";

const fallbackBattlefieldName = (battlefield: BattlefieldListItem) => {
  if (battlefield.name?.trim()) {
    return battlefield.name.trim();
  }

  const firstLine = battlefield.briefing
    ?.split("\n")
    .find((line) => line.trim().length > 0)
    ?.trim();
  if (firstLine?.startsWith("#")) {
    return firstLine.replace(/^#+\s*/, "").trim() || `Battlefield #${battlefield.id}`;
  }

  return `Battlefield #${battlefield.id}`;
};

export const BattlefieldCard = ({
  battlefield,
  onOpenWizard,
}: {
  battlefield: BattlefieldListItem;
  onOpenWizard: (battlefieldId: number) => void;
}) => {
  const displayName = fallbackBattlefieldName(battlefield);
  const briefing = battlefield.briefing?.trim() || "No briefing captured yet.";
  const hasSpecsheetImage = Boolean(battlefield.specsheetImageUrl);

  return (
    <Card className="border-border/90 bg-card/95 hover:border-secondary/60">
      <CardHeader className="p-2">
        <div className="flex items-center justify-between gap-2">
          <WizardCardTitle className="min-w-0 truncate">{displayName}</WizardCardTitle>
          <Badge
            className="shrink-0 border-primary/40 bg-background/85 px-2 py-1 text-[10px] tracking-[0.14em] text-primary"
            variant="outline"
          >
            Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <button
          aria-label={`Open wizard for ${displayName}`}
          className="w-full text-left"
          onClick={() => onOpenWizard(battlefield.id)}
          type="button"
        >
          <div>
            <div
              aria-label={
                hasSpecsheetImage ? `${displayName} specsheet image` : "Specsheet pending"
              }
              className={cn(
                "h-[350px] border-r border-border bg-muted/30 bg-cover bg-center",
                !hasSpecsheetImage && "flex items-center justify-center px-2 text-center",
              )}
              style={
                hasSpecsheetImage
                  ? {
                      backgroundImage: `linear-gradient(rgba(8, 10, 12, 0.25), rgba(8, 10, 12, 0.25)), url("${battlefield.specsheetImageUrl}")`,
                    }
                  : undefined
              }
            >
              {!hasSpecsheetImage ? (
                <span className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                  Pending
                </span>
              ) : null}
            </div>
            <div className="space-y-1.5 p-3">
              <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">
                {briefing}
              </p>
            </div>
          </div>
          <div className="sr-only">
            {hasSpecsheetImage ? `${displayName} specsheet image` : "Specsheet pending"}
          </div>
        </button>
      </CardContent>
    </Card>
  );
};
