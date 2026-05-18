import type { MyFighter } from "@ijf/shared";

import { Badge } from "../../../components/ui/badge";
import { Card, CardContent } from "../../../components/ui/card";
import { cn } from "../../../lib/utils";

const parseDisplayName = (characterDescription: string | null, slug: string, id: number) => {
  if (characterDescription) {
    const nameMatch = characterDescription.match(/^#\s+(.+)$/m);
    const parsed = nameMatch?.[1]?.trim();
    if (parsed) {
      return parsed;
    }
  }

  return slug.length > 0 ? slug : `Fighter ${id}`;
};

const statusLabelByCode: Record<MyFighter["status"], string> = {
  locked: "Locked",
  ready: "Ready",
  generating: "Generating",
  complete: "Complete",
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
  onClick: (fighterId: number) => void;
};

export const FighterBadgeCard = ({ fighter, onClick }: FighterBadgeCardProps) => {
  const displayName = parseDisplayName(fighter.characterDescription, fighter.slug, fighter.id);
  const briefing = fighter.briefing?.trim() || "No briefing captured yet.";
  const hasSpecsheetImage = Boolean(fighter.specsheetImageUrl);

  return (
    <button className="text-left" onClick={() => onClick(fighter.id)} type="button">
      <Card className="border-border/90 bg-card/95 hover:border-secondary/60">
        <CardContent className="p-0">
          <div className="grid min-h-44 grid-cols-[210px_1fr]">
            <div
              aria-label={
                hasSpecsheetImage ? `${displayName} specsheet image` : "Specsheet pending"
              }
              className={cn(
                "border-r border-border bg-muted/30 bg-cover bg-center",
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
              <p className="truncate text-xs font-bold tracking-[0.14em] text-foreground uppercase">
                {displayName}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">{briefing}</p>
              <div>
                <Badge
                  className={cn(
                    "shrink-0 bg-background/85 px-2 py-1 text-[10px] tracking-[0.14em]",
                    statusClassByCode[fighter.status],
                  )}
                  variant="outline"
                >
                  {statusLabelByCode[fighter.status]}
                </Badge>
              </div>
            </div>
          </div>
          <div className="sr-only">
            {hasSpecsheetImage ? `${displayName} specsheet image` : "Specsheet pending"}
          </div>
        </CardContent>
      </Card>
    </button>
  );
};
