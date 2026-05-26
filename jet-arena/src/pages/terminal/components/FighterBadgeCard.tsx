import { type MyFighter, resolveFighterName } from "@ijf/shared";
import { EllipsisVertical, Trash2 } from "lucide-react";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { cn } from "../../../lib/utils";
import { WizardCardTitle } from "../../wizard/sections/WizardCardTitle";

const statusLabelByCode: Record<MyFighter["status"], string> = {
  locked: "Locked",
  ready: "Ready",
  generating: "Generating",
  complete: "Done",
  error: "Error",
};

const statusClassByCode: Record<MyFighter["status"], string> = {
  locked: "border-border text-muted-foreground",
  ready: "border-primary/40 text-primary",
  generating: "border-secondary/60 text-secondary",
  complete: "border-emerald-400/60 text-emerald-300",
  error: "border-destructive/60 text-destructive",
};

type FighterBadgeCardProps = {
  fighter: MyFighter;
  isSelected: boolean;
  isDeleting?: boolean;
  onDelete?: (fighterId: number) => void;
  onOpenWizard: (fighterId: number) => void;
  onToggleSelected?: (fighterId: number) => void;
};

export const FighterBadgeCard = ({
  fighter,
  isSelected,
  isDeleting = false,
  onDelete,
  onOpenWizard,
}: FighterBadgeCardProps) => {
  const displayName = resolveFighterName({
    storedName: fighter.name,
    characterDescription: fighter.characterDescription,
    slug: fighter.slug,
  });
  const briefing = fighter.briefing?.trim() || "No briefing captured yet.";
  const hasSpecsheetImage = Boolean(fighter.specsheetImageUrl);

  return (
    <Card
      className={cn(
        "border-border/90 bg-card/95 hover:border-secondary/60",
        isSelected && "border-secondary ring-1 ring-secondary/50",
      )}
    >
      <CardHeader className="p-2">
        <div className="flex items-center justify-between gap-2">
          <WizardCardTitle className="min-w-0 truncate">{displayName}</WizardCardTitle>
          <div className="flex items-center gap-1">
            <Badge
              className={cn(
                "shrink-0 bg-background/85 px-2 py-1 text-[10px] tracking-[0.14em]",
                statusClassByCode[fighter.status],
              )}
              variant="outline"
            >
              {statusLabelByCode[fighter.status]}
            </Badge>
            {onDelete ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={`Open actions for ${displayName}`}
                    className="h-7 w-7 p-0"
                    disabled={isDeleting}
                    size="sm"
                    type="button"
                    variant="outline"
                    color="muted"
                  >
                    <EllipsisVertical className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => onDelete(fighter.id)}
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <button
          aria-label={`Open wizard for ${displayName}`}
          className="w-full text-left"
          onClick={() => onOpenWizard(fighter.id)}
          type="button"
        >
          <div>
            <div
              aria-label={
                hasSpecsheetImage ? `${displayName} specsheet image` : "Specsheet pending"
              }
              className={cn(
                "h-[453px] border-r border-border bg-muted/30 bg-cover bg-center",
                !hasSpecsheetImage && "flex items-center justify-center px-2 text-center",
              )}
              style={
                hasSpecsheetImage
                  ? {
                      backgroundImage: `linear-gradient(rgba(8, 10, 12, 0.25), rgba(8, 10, 12, 0.25)), url("${fighter.specsheetImageUrl}")`,
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
              <p className="text-xs leading-relaxed text-muted-foreground">{briefing}</p>
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
